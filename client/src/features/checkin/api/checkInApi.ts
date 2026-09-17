import { http } from '@/shared/api';
import type { CheckInResult, CheckInSource, CheckInTicket } from '../model/checkIn.types';

/**
 * 게이트 입장 확인 API — 전부 **ADMIN 전용**입니다 (`/admin/check-in/**`).
 *
 * 🔴 **이미지를 보내는 함수를 여기 만들지 마세요.** 얼굴 원본은 검표기 브라우저 안에서
 * 시작해 안에서 끝납니다. 나가는 것은 임베딩과 모델 버전뿐입니다 (CLAUDE.md 7장).
 *
 * 🔴 **대조와 판정은 서버가 합니다.** 티켓에 베껴 둔 임베딩을 받아와 여기서 비교하는
 * 함수를 만들지 마세요 — 생체 특징값이 기기로 나가고, 콘솔로 통과시킬 수 있게 됩니다.
 */
export const checkInApi = {
  /** 1단계 — 이 표가 이 회차의 것인지 확인만 합니다 (입장 처리 안 함) */
  scan: (source: CheckInSource, performanceDetailId: number) =>
    http.post<CheckInTicket>('/admin/check-in/scan', { ...source, performanceDetailId }),

  /** 2단계 — 얼굴을 대조하고, 같은 사람이면 서버가 입장 처리합니다 */
  verify: (
    source: CheckInSource,
    performanceDetailId: number,
    embedding: number[],
    modelVersion: string,
  ) =>
    http.post<CheckInResult>('/admin/check-in/verify', {
      ...source,
      performanceDetailId,
      embedding,
      modelVersion,
    }),
};
