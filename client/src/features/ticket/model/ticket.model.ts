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
 *
 * 🔴 NFT 발행 상태는 보지 않습니다. 발행이 밀려도(`PENDING`) 예매는 유효합니다.
 */
export function isUsable(ticket: Ticket): boolean {
  return ticket.status === 'CONFIRMED' && !isPast(ticket);
}

/** 관람 예정 — 내 티켓 목록의 첫 탭 */
export function isUpcoming(ticket: Ticket): boolean {
  return isUsable(ticket);
}

/**
 * 취소 가능 여부 — 공연이 시작되면 취소할 수 없습니다 (서버 `PAYMENT_014` 와 같은 규칙).
 * 주문을 모르는 티켓은 취소할 방법이 없습니다 (`ticket.types` 의 orderId 주석).
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

/** 'A 12열 5번' — 스탠딩이면 열·번호가 없습니다 */
export function seatText(ticket: Ticket): string {
  if (ticket.row === null || ticket.number === null) return `${ticket.sectionName} 스탠딩`;
  return `${ticket.sectionName} ${ticket.row}열 ${ticket.number}번`;
}

/**
 * NFT 발행이 아직 끝나지 않았을 때만 한 줄 알려줍니다.
 *
 * 🔴 예매 상태와 **다른 축**입니다. 발행이 밀렸다고 예매가 실패한 것처럼 보이면 안 됩니다 —
 *    그래서 경고가 아니라 안내 문구이고, `MINTED`·`BURNED` 면 아무것도 말하지 않습니다.
 */
export function nftIssueNote(ticket: Ticket): string | null {
  switch (ticket.nftStatus) {
    case 'PENDING':
    case 'MINTING':
      return 'NFT 티켓을 발행하는 중이에요. 예매는 이미 확정됐습니다.';
    case 'FAILED':
      return 'NFT 발행이 지연되고 있어요. 예매와 입장에는 영향이 없습니다.';
    default:
      return null;
  }
}

/**
 * 입장 QR 에 실을 값.
 *
 * ⚠️ QR 규격은 **아직 백엔드와 정해지지 않았습니다** (CLAUDE.md 8장).
 *    지금은 티켓 ID 만 담고, 규격이 정해지면 이 함수 하나만 고칩니다.
 */
export function qrPayload(ticket: Ticket): string {
  return `TICKET:${ticket.id}`;
}
