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

/**
 * 취소표 추첨 대기를 걸 수 있는가 — **매진된 뒤에만**.
 *
 * 티켓팅이 열리기 전(BEFORE)에 대기를 받으면 "미리 줄 서기" 가 되어 선착순과 다를 게 없어지고,
 * 마감(CLOSED)된 회차는 취소표가 다시 팔릴 일이 없습니다.
 * 구역 단위의 매진 여부는 취소표 화면이 구역 목록에서 다시 봅니다.
 */
export function canWaitlist(schedule: Pick<ScheduleSummary, 'bookingStatus'>): boolean {
  return schedule.bookingStatus === 'SOLDOUT';
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
