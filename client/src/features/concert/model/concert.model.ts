import { formatDateTime } from '@/shared/lib';
import type {
  BookingOpenCheck,
  BookingOpenStatus,
  ConcertDetail,
  ConcertSummary,
} from './concert.types';

/**
 * 지금 예매할 수 있는 공연인가 (목록 카드 칩, 홈의 "예매중" 레일).
 *
 * 🔴 **직접 계산하지 마세요.** 예전에는 `ticketingStartAt <= now` 하나만 봤는데, 그러면
 *    회차가 전부 마감·매진이거나 **공연 날짜가 지난 공연도 "예매중"** 으로 보였습니다.
 *    들어가 보면 전부 마감이라 "왜 예매가 안 되냐" 가 됩니다.
 *    지금은 서버가 회차를 합쳐 계산한 `bookingStatus` 를 그대로 씁니다.
 */
export function isConcertOpen(concert: ConcertSummary): boolean {
  return concert.bookingStatus === 'OPEN';
}

/** 목록 카드 칩 문구. 회차 목록의 문구(`scheduleStatusLabel`)와 달리 공연 한 건을 요약합니다 */
export const CONCERT_BOOKING_LABEL: Record<BookingOpenStatus, string> = {
  OPEN: '예매중',
  BEFORE: '오픈 예정',
  SOLDOUT: '매진',
  CLOSED: '예매 마감',
};

/**
 * 예매를 시작할 수 없을 때 사용자에게 할 말.
 *
 * 오픈 전 회차도 버튼을 살려두기 때문에(누르면 서버에 물어봅니다) 이 문구가
 * "왜 지금은 안 되는지" 를 대신합니다. 오픈이 코앞이면 시각 대신 "곧" 이라고 씁니다 —
 * 1분도 안 남았는데 시각을 읽어주면 오히려 계산을 시킵니다.
 */
export function bookingNotOpenMessage(check: BookingOpenCheck): string {
  switch (check.status) {
    case 'BEFORE':
      return check.secondsUntilOpen <= 60
        ? '곧 열려요. 잠시 후 다시 눌러 주세요.'
        : `아직 예매 시간이 아니에요. ${formatDateTime(check.ticketingStartAt)}에 열립니다.`;
    case 'SOLDOUT':
      return '매진됐어요. 취소표 추첨 대기를 신청할 수 있어요.';
    case 'CLOSED':
      return '예매가 마감된 회차예요.';
    default:
      return '지금은 예매할 수 없어요.';
  }
}

/**
 * 포스터가 없을 때 그라데이션을 만드는 시드.
 * 같은 공연은 언제 어디서 그려도 같은 색이 나와야 하므로 ID 로 만듭니다.
 */
export function posterSeedOf(concert: Pick<ConcertSummary | ConcertDetail, 'concertId'>): string {
  return `concert-${concert.concertId}`;
}

/* 수정·삭제 버튼을 보일지는 역할까지 봐야 해서 `features/auth` 의 `can.manageThisConcert` 에 있습니다
   — ADMIN 은 남의 공연도 다루고, PERFORMANCE 는 자기가 등록한 것만 다룹니다. */
