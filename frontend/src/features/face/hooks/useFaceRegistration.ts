import { useMutation } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { ROUTES } from '@/shared/constants';
import { authKeys, type User } from '@/features/auth';
import { faceApi } from '../api/faceApi';

/** RequireFace 가드가 넘겨준 "원래 가려던 곳" */
interface FaceLocationState {
  from?: { pathname?: string };
}

export function useFaceRegistration() {
  const navigate = useNavigate();
  const location = useLocation();
  return useMutation({
    mutationFn: (image: Blob) => faceApi.register(image),
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

      toast.success('얼굴 등록이 완료됐어요.');

      // navigate(-1) 은 리다이렉트로 들어온 경우 엉뚱한 곳(로그인 등)으로 갑니다.
      // 가드가 알려준 원래 목적지로 보내고, 없으면 홈으로.
      const state = location.state as FaceLocationState | null;
      navigate(state?.from?.pathname ?? ROUTES.MY, { replace: true });
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '등록에 실패했어요.'),
  });
}
