import type { Ticket } from './ticket.types';

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
  return ticket.status === 'VALID' && !isPast(ticket);
}

/** 취소 가능 여부 — 공연 시작 후에는 취소 불가 */
export function isCancelable(ticket: Ticket): boolean {
  return ticket.status === 'VALID' && !isPast(ticket);
}

export function ticketStatusLabel(ticket: Ticket): string {
  if (ticket.status === 'CANCELED') return '취소됨';
  if (ticket.status === 'USED') return '사용 완료';
  return isPast(ticket) ? '관람 완료' : '예매 완료';
}

export function ticketTone(ticket: Ticket) {
  if (ticket.status === 'CANCELED') return 'danger' as const;
  if (ticket.status === 'USED' || isPast(ticket)) return 'neutral' as const;
  return 'brand' as const;
}

export function seatText(ticket: Ticket): string {
  return `${ticket.sectionName} ${ticket.row}열 ${ticket.number}번`;
}
