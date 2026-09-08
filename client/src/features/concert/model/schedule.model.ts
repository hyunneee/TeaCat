import type { ScheduleSummary } from './concert.types';

/**
 * 회차를 지금 예매할 수 있는가.
 *
 * 판단은 서버가 합니다(`bookable`). 클라이언트 시계로 다시 계산하면
 * 시계가 어긋난 기기에서 오픈 전에 버튼이 켜지거나 오픈을 놓칩니다.
 */
export function isBookable(schedule: ScheduleSummary): boolean {
  return schedule.bookable;
}

export function scheduleStatusLabel(schedule: ScheduleSummary): string {
  switch (schedule.bookingStatus) {
    case 'BEFORE':
      return '오픈 예정';
    case 'SOLDOUT':
      return '매진';
    case 'CLOSED':
      return '예매 마감';
    default:
      return '예매 가능';
  }
}

/** 예매 상태에 따른 뱃지 톤 */
export function scheduleTone(schedule: ScheduleSummary) {
  switch (schedule.bookingStatus) {
    case 'BEFORE':
      return 'info' as const;
    case 'OPEN':
      return 'success' as const;
    default:
      return 'neutral' as const;
  }
}
