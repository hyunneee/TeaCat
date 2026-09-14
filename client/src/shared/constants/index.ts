export { ROUTES, BOOKING_STEPS } from './routes';
export { FEATURE } from './features';

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

export const BREAKPOINT = {
  sm: 640,
  md: 768,
  lg: 1024,
} as const;
