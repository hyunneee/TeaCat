import { http } from '@/shared/api';
import type { NftStatus, Ticket, TicketStatus } from '../model/ticket.types';

/**
 * 티켓 API.
 *
 * ── 경로가 `/users/me/*` 입니다 ─────────────────────────────
 * 예매 선점은 `/me/holds`, 티켓은 `/users/me/tickets` 로 서버 쪽 접두어가 다릅니다.
 * 그 차이를 화면까지 옮기지 않으려고 이 파일에서만 압니다.
 *
 * ── 취소는 여기 없습니다 ────────────────────────────────────
 * 예매 취소는 티켓이 아니라 **주문**에 걸려 있습니다
 * (`POST /payments/ticket-orders/{orderId}/cancel`). 카드 취소·캣머니 환급·NFT 소각이
 * 한 주문에 묶여 있어서입니다 — `features/payment` 의 `useCancelOrder` 를 쓰세요.
 */

/* ── 서버 응답 형태 (여기서만 압니다) ───────────────────────── */

interface ApiMyTicket {
  ticketId: number;
  ticketOrderId: number | null;
  status: TicketStatus;
  title: string;
  posterUrl: string | null;
  performanceNum: number;
  performanceDate: string;
  stadiumName: string;
  stadiumAddress: string;
  areaCode: string;
  rowLabel: string | null;
  seatNumber: number | null;
  nftStatus: NftStatus | null;
  tokenId: string | null;
  bookedAt: string;
}

const toTicket = (api: ApiMyTicket): Ticket => ({
  id: String(api.ticketId),
  orderId: api.ticketOrderId,
  status: api.status,
  concertTitle: api.title,
  posterUrl: api.posterUrl,
  performanceNum: api.performanceNum,
  startAt: api.performanceDate,
  venueName: api.stadiumName,
  venueAddress: api.stadiumAddress,
  sectionName: api.areaCode,
  row: api.rowLabel,
  number: api.seatNumber,
  nftStatus: api.nftStatus,
  tokenId: api.tokenId,
  bookedAt: api.bookedAt,
});

export const ticketApi = {
  /** 내 티켓 전부. 서버가 상태 필터를 받지 않으므로 화면에서 갈라 씁니다 */
  list: () => http.get<ApiMyTicket[]>('/users/me/tickets').then((list) => list.map(toTicket)),

  detail: (ticketId: string) =>
    http.get<ApiMyTicket>(`/users/me/tickets/${ticketId}`).then(toTicket),
};

export const ticketKeys = {
  all: ['ticket'] as const,
  list: () => [...ticketKeys.all, 'list'] as const,
  detail: (ticketId: string) => [...ticketKeys.all, 'detail', ticketId] as const,
};
