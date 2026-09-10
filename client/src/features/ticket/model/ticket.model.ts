import type { NftStatus, Ticket } from './ticket.types';

/**
 * 내 티켓 규칙 (순수 도메인 로직).
 *
 * 컴포넌트가 아니라 여기 모아둡니다 — 규칙이 바뀌어도 화면 코드를 안 건드리고,
 * 렌더링 없이 테스트할 수 있습니다. (booking 의 `seat.model.ts` 와 같은 방식)
 */

/** 공연이 이미 지났는가 */
export function isPast(ticket: Ticket): boolean {
  return new Date(ticket.startAt).getTime() < Date.now();
}

/**
 * 입장에 쓸 수 있는 티켓인가.
 *
 * 얼굴 등록 여부는 사용자 속성이라 여기서 판단하지 않습니다.
 * (features/auth 의 `can.useTicket(user)` 와 조합해서 씁니다)
 */
export function isUsable(ticket: Ticket): boolean {
  return ticket.status === 'CONFIRMED' && !isPast(ticket);
}

/**
 * 취소할 수 있는가.
 *
 * 🔴 `orderId` 를 함께 봅니다. 취소는 주문 단위라 주문을 모르면 **요청 자체를 못 보냅니다.**
 *    (결제 직후 아주 짧은 구간이나 옛 데이터에서 주문이 비어 있을 수 있습니다)
 */
export function isCancelable(ticket: Ticket): boolean {
  return ticket.status === 'CONFIRMED' && !isPast(ticket) && ticket.orderId !== null;
}

export function ticketStatusLabel(ticket: Ticket): string {
  if (ticket.status === 'CANCELLED') return '취소됨';
  return isPast(ticket) ? '관람 완료' : '예매 완료';
}

export function ticketTone(ticket: Ticket) {
  if (ticket.status === 'CANCELLED') return 'danger' as const;
  if (isPast(ticket)) return 'neutral' as const;
  return 'brand' as const;
}

/** 'A구역 3열 12번' — 스탠딩 구역은 열·번호가 없습니다 */
export function seatText(ticket: Ticket): string {
  if (ticket.row === null || ticket.number === null) return `${ticket.sectionName}구역 스탠딩`;
  return `${ticket.sectionName}구역 ${ticket.row}열 ${ticket.number}번`;
}

/**
 * NFT 발행 상태 문구. 발행 전이거나 상태를 모르면 null 이라 화면에서 줄을 통째로 뺍니다.
 *
 * 🔴 실패를 "예매 실패" 로 읽히게 쓰지 마세요 — 서버가 재시도하는 중이고 예매는 유효합니다.
 */
export function nftStatusLabel(status: NftStatus | null): string | null {
  switch (status) {
    case 'PENDING':
    case 'MINTING':
      return '발행 중';
    case 'MINTED':
      return '발행 완료';
    case 'BURNED':
      return '소각됨';
    case 'FAILED':
      return '발행 재시도 중';
    default:
      return null;
  }
}
