import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/shared/api';
import { env } from '@/shared/config';
import { toast } from '@/shared/stores';
import { trackGaEvent } from '@/shared/lib';
import { faceApi } from '../api/faceApi';

/**
 * 본인 확인 — 지금 찍은 얼굴을 서버로 보내 등록해 둔 얼굴과 대조합니다.
 *
 * 🔴 인자는 `Float32Array` 입니다. **이미지가 아닙니다.** (CLAUDE.md 7장)
 *
 * ── 왜 서버가 비교하나 ─────────────────────────────────────
 * 저장된 임베딩을 받아와 브라우저에서 코사인 유사도를 재면 두 가지가 무너집니다.
 * 생체 특징값이 기기로 나가고, 판정이 클라이언트에 있으니 콘솔로 통과시킬 수 있습니다.
 * 그래서 **올려 보내고 답만 받습니다.** 게이트 검표가 붙어도 같은 모양입니다.
 *
 * 결과는 `mutate` 의 `onSuccess` 로 받거나 `data` 로 읽습니다. 성공/실패 토스트를
 * 여기서 띄우지 않는 이유는, "안 닮았다" 도 정상 응답이라 화면이 직접 보여주기 때문입니다.
 * (토스트로 지나가면 점수를 볼 수 없습니다 — 지금은 임계값을 맞춰보는 단계입니다)
 */
export function useFaceVerify() {
  return useMutation({
    mutationFn: (embedding: Float32Array) =>
      faceApi.verify({
        embedding: Array.from(embedding),
        modelVersion: env.face.modelVersion,
      }),
    /* 🔴 `match: false` 는 **에러가 아니라 정상 응답**입니다 (안 닮았다는 답).
       onSuccess 에서 갈라야 "인증에서 몇 %가 떨어지나" 가 잡힙니다 —
       onError 만 세면 그 사람들이 통과한 것처럼 보입니다.
       🔴 similarity·threshold 는 보내지 않습니다. 생체 판정 점수라 GA 에 남길 값이 아닙니다. */
    onSuccess: (result) =>
      trackGaEvent(result.match ? 'face_verify_success' : 'face_verify_fail', {
        ...(result.match ? {} : { fail_reason: 'NO_MATCH' }),
      }),
    onError: (error) => {
      trackGaEvent('face_verify_fail', {
        fail_reason: ApiError.isApiError(error) ? error.code : 'NETWORK',
      });
      toast.error(
        ApiError.isApiError(error) ? error.message : '본인 확인에 실패했어요. 다시 시도해 주세요.',
      );
    },
  });
}
