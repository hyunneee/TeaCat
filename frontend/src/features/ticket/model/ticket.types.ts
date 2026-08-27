export type TicketStatus = 'VALID' | 'CANCELED' | 'USED';

export interface Ticket {
  id: string;
  orderId: string;
  status: TicketStatus;
  price: number;
  issuedAt: string;
  /** 이 티켓을 실제로 쓸 사람 (결제 시점에 확정된 수령인) */
  ownerName: string;

  concertId: string;
  concertTitle: string;
  artist: string;
  posterSeed: string;
  startAt: string;

  venueName: string;
  venueAddress: string;
  sectionName: string;
  row: string;
  number: number;

  /** 입장 QR 페이로드. 규격은 백엔드와 협의 필요. */
  qrPayload: string;
}

export interface CancelResult {
  ticketId: string;
  refundAmount: number;
}
