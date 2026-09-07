import type { ConcertDetail, ConcertSummary } from './concert.types';

/**
 * 티켓팅이 열렸는가 (목록 카드의 "예매중" / "오픈 예정" 칩).
 *
 * 목록 응답에는 서버가 계산한 오픈 상태가 없어 여기서 비교합니다.
 * 카운트다운처럼 초 단위가 중요한 곳은 회차 API 의 `bookingStatus` 를 쓰세요 —
 * 이 값은 목록에서 칩을 고르는 용도라 몇 초 어긋나도 괜찮습니다.
 */
export function isTicketingOpen(concert: ConcertSummary, now: Date = new Date()): boolean {
  return new Date(concert.ticketingStartAt).getTime() <= now.getTime();
}

/**
 * 포스터가 없을 때 그라데이션을 만드는 시드.
 * 같은 공연은 언제 어디서 그려도 같은 색이 나와야 하므로 ID 로 만듭니다.
 */
export function posterSeedOf(concert: Pick<ConcertSummary | ConcertDetail, 'concertId'>): string {
  return `concert-${concert.concertId}`;
}

/**
 * 이 사용자가 등록한 공연인가.
 *
 * 서버가 관리자 API 를 등록자 본인에게만 허용하므로(PERFORMANCE_020), 화면도 같은 기준으로
 * 수정·삭제 버튼을 보여줍니다. 남의 공연에 버튼을 보이면 눌러도 403 만 납니다.
 */
export function isConcertOwner(concert: Pick<ConcertDetail, 'createdBy'>, userId: number | undefined): boolean {
  return concert.createdBy != null && concert.createdBy === userId;
}
