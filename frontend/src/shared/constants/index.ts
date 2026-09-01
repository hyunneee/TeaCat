export { ROUTES, BOOKING_STEPS } from './routes';

/** 서버 상태 캐시 정책 — 화면 성격별 프리셋 */
export const STALE_TIME = {
  /** 좌석 잔여, 대기열 — 항상 최신 */
  REALTIME: 0,
  /** 티켓 목록, 내 정보 */
  SHORT: 30_000,
  /** 공연 상세, 공연장 정보 */
  LONG: 5 * 60_000,
} as const;

/** 좌석을 잡아두는 시간(초). 서버 TTL 과 반드시 같아야 합니다. */
export const SEAT_HOLD_SECONDS = 420; // 7분

/** 취소표 당첨 후 결제 마감 (플로우차트: 12시간 내 좌석 결제) */
export const RESALE_PAYMENT_HOURS = 12;

/**
 * 캣머니(포인트) 1개의 원화 가치.
 *
 * 화면에 "몇 캣머니가 빠지는지" 미리 보여주기 위한 값입니다.
 * ⚠️ **실제 차감량은 서버가 다시 계산합니다.** 이 값으로 계산한 숫자를
 *    결제 요청에 실어 보내지 마세요. (금액의 출처는 언제나 서버 — CLAUDE.md 7장)
 */
export const POINT_UNIT_KRW = 100;

/** 원 → 캣머니 (표시용 어림값) */
export function toPoints(krw: number): number {
  return Math.ceil(krw / POINT_UNIT_KRW);
}

export const BREAKPOINT = {
  sm: 640,
  md: 768,
  lg: 1024,
} as const;
