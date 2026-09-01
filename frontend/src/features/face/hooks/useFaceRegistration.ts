import { useMutation } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { ROUTES } from '@/shared/constants';
import { env } from '@/shared/config';
import { authKeys, type User } from '@/features/auth';
import { faceApi } from '../api/faceApi';

/** RequireFace 가드가 넘겨준 "원래 가려던 곳" */
interface FaceLocationState {
  from?: { pathname?: string };
}

/**
 * 임베딩을 서버에 등록합니다.
 *
 * 🔴 인자가 `Float32Array` 인 것에 주의하세요. **이미지가 아닙니다.**
 *    이 훅에 Blob 을 받는 오버로드를 추가하지 마세요. (CLAUDE.md 7장)
 */
export function useFaceRegistration() {
  const navigate = useNavigate();
  const location = useLocation();

  return useMutation({
    mutationFn: (embedding: Float32Array) =>
      faceApi.enroll({
        // JSON 으로 나가야 하므로 일반 배열로. 512개면 약 6KB 입니다.
        embedding: Array.from(embedding),
        modelVersion: env.face.modelVersion,
      }),
    onSuccess: () => {
      // 내 정보의 원본은 **쿼리 캐시 하나**입니다. 스토어를 따로 고치지 마세요 —
      // 스냅샷은 useAuth 가 여기서 베껴 갑니다. (features/auth/hooks/useAuth.ts)
      //
      // invalidate 만 하면 재조회가 끝나기 전에 화면이 이동해서
      // RequireFace 가드가 옛 캐시(faceRegistered: false)를 보고 되튕깁니다.
      // 캐시를 즉시 갱신한 뒤, 재검증은 백그라운드로 돌립니다.
      queryClient.setQueryData(authKeys.me(), (prev: User | undefined) =>
        prev ? { ...prev, faceRegistered: true } : prev,
      );
      void queryClient.invalidateQueries({ queryKey: authKeys.me() });

      // 완료를 **화면 하나로** 알립니다. 앱에서 딱 한 번 하는 일인데
      // 상단 알림 한 줄로 지나가면 "등록이 된 건가?" 싶어 다시 찾아옵니다.
      //
      // 원래 가려던 곳(가드가 넘겨준 from)은 그대로 들고 갑니다 —
      // 완료 화면의 "이어서 진행하기" 가 그 자리로 보냅니다.
      // (navigate(-1) 은 리다이렉트로 들어온 경우 엉뚱한 곳으로 갑니다)
      const state = location.state as FaceLocationState | null;
      navigate(ROUTES.FACE_DONE, { replace: true, state: { from: state?.from } });
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '등록에 실패했어요.'),
  });
}
