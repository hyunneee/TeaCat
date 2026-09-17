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

/**
 * 홈 레일에 남길 공연인가 — **끝난 것만 뺍니다.**
 *
 * 🔴 매진됐다고 홈에서 지우면, 표를 산 사람이 자기가 가는 공연을 홈에서 찾지 못합니다.
 * "살 수 있는가" 와 "볼 만한가" 는 다른 질문입니다. 취소표가 나올 수도 있고,
 * 상세에 들어가면 회차별로 무엇이 남았는지 보입니다.
 *
 * 🔴 <b>오픈 예정(BEFORE)도 함께 남깁니다.</b> 예전에는 열린 공연이 하나라도 있으면 예정을
 * 통째로 감췄는데, 그래서 "다음에 뭐가 열리지" 를 홈에서 알 수 없었습니다. 티켓팅은 몇 분이고
 * 그 사이는 몇 주라, 예정이야말로 사람들이 보러 오는 정보입니다.
 * 섞여도 헷갈리지 않는 것은 카드마다 상태 칩(예매중·매진·오픈 예정)이 붙기 때문입니다.
 *
 * 상태를 명시적으로 나열합니다 — `!== 'CLOSED'` 로 쓰면 서버가 값을 안 준 공연(구버전 응답)이
 * 조용히 섞여 들어와 칩이 빈 채로 그려집니다.
 */
export function isConcertOnRail(concert: ConcertSummary): boolean {
  return (
    concert.bookingStatus === 'OPEN' ||
    concert.bookingStatus === 'SOLDOUT' ||
    concert.bookingStatus === 'BEFORE'
  );
}

/**
 * 홈 레일 정렬 — **티켓팅 시각 오름차순 하나**입니다.
 *
 * ── 이 한 줄이 두 가지를 동시에 해결합니다 ──────────────────
 * 이미 열린 공연은 티켓팅 시각이 **과거**라 언제나 앞에 오고, 그 뒤에 오픈 예정이
 * **임박한 순서**로 붙습니다. "진행 중인 것이 먼저" 와 "가장 일찍 열리는 것이 앞" 이
 * 따로 규칙을 두지 않아도 같이 성립합니다.
 *
 * 🔴 **예전에는 상태로 칸을 나눴습니다**(예매중·매진이 한 칸, 예정이 다음 칸). 그런데 칸
 * 안에서는 서버 순서(= 최신 등록순)를 그대로 썼더니, 최근에 올린 공연이 앞을 차지해
 * **지금 예매할 수 있는 공연이 레일 8장 밖으로 밀려났습니다** (QA: "진행 중인 게 잘 안 보인다").
 * 상태 칸을 없애고 시각 하나로 줄여서 그 밀림을 없앴습니다.
 *
 * ⚠️ 예매중끼리는 **가장 오래 전에 열린 공연이 맨 앞**입니다. 대체로 마감이 가까운 쪽이라
 * 의도한 결과지만, 새로 올린 공연은 뒤로 갑니다 — 레일은 앞에서부터 잘리므로
 * (`RAIL_LIMIT`) 공연이 많아지면 새 공연이 홈에서 안 보일 수 있습니다.
 *
 * 문자열 비교로 충분합니다 — 서버가 주는 값이 `2026-10-08T19:00:00` 형식이라
 * 사전식 순서가 곧 시간순입니다. `new Date` 로 파싱하면 카드 수만큼 객체만 늘어납니다.
 */
export function compareForRail(a: ConcertSummary, b: ConcertSummary): number {
  return a.ticketingStartAt.localeCompare(b.ticketingStartAt);
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
