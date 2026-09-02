import type { ScheduleSummary } from './concert.types';

/** 잔여 좌석 비율 (0~1) */
export function remainRatio(schedule: ScheduleSummary): number {
  if (schedule.totalSeats === 0) return 0;
  return schedule.availableSeats / schedule.totalSeats;
}

/**
 * 회차를 지금 예매할 수 있는가.
 * "오픈 전" / "매진" 판단을 화면마다 다시 쓰지 않기 위해 한곳에 둡니다.
 */
export function isBookable(schedule: ScheduleSummary): boolean {
  return schedule.status === 'OPEN' && schedule.availableSeats > 0;
}

export function scheduleStatusLabel(schedule: ScheduleSummary): string {
  if (schedule.status === 'UPCOMING') return '오픈 예정';
  if (schedule.availableSeats === 0) return '매진';
  if (schedule.status === 'CLOSED') return '예매 마감';
  return '예매 가능';
}

/** 잔여율에 따른 뱃지 톤 */
export function scheduleTone(schedule: ScheduleSummary) {
  if (schedule.status === 'UPCOMING') return 'info' as const;
  if (schedule.availableSeats === 0) return 'neutral' as const;
  return remainRatio(schedule) < 0.1 ? ('danger' as const) : ('success' as const);
}
