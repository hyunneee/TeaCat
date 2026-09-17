import { http } from '@/shared/api';
import type { NftStatus, Ticket, TicketStatus } from '../model/ticket.types';

/**
 * 내 티켓 API — 서버와 만나는 유일한 지점.
 *
 * ── 조회와 취소가 서로 다른 도메인에 있습니다 ────────────────────
 *   조회  `GET  /users/me/tickets`                        ticket 도메인
 *   취소  `POST /payments/ticket-orders/{orderId}/cancel`  payment 도메인
 * **취소는 티켓이 아니라 주문 단위**라서 경로도 도메인도 다릅니다. 그 사정을 화면까지
 * 옮기지 않으려고 이 파일에서만 두 경로를 알고, 밖으로는 티켓 하나만 노출합니다.
 *
 * ── 응답을 그대로 쓰지 않는 이유 ────────────────────────────────
 * 서버는 `title/stadiumName/areaCode/rowLabel...`, 화면은 `concertTitle/venueName/...` 로
 * 부릅니다. 아래 어댑터가 경계에서 한 번만 옮깁니다.
 *
 * 🔴 서버는 **null 필드를 JSON 에서 아예 뺍니다** (`@JsonInclude(NON_NULL)`).
 *    그래서 어댑터의 모든 선택 필드는 `?? null` 로 받습니다 — undefined 가 화면까지 새면
 *    "값이 없음" 과 "필드가 없음" 이 달라져 조건문이 어긋납니다.
 */

/* ── 서버 응답 형태 (여기서만 압니다) ───────────────────────── */

interface ApiTicket {
  ticketId: number;
  status: TicketStatus;
  title: string;
  posterUrl?: string | null;
  performanceNum: number;
  performanceDate: string;
  stadiumName: string;
  stadiumAddress: string;
  areaCode: string;
  rowLabel?: string | null;
  seatNumber?: number | null;
  nftStatus?: NftStatus | null;
  tokenId?: string | null;
  bookedAt: string;
  ticketOrderId?: number | null;
  totalAmount?: number | null;
}

/** 게이트에 보여줄 QR. 이미지가 아니라 **문자열**이고 그림은 화면이 그립니다 */
interface ApiTicketQr {
  token: string;
}

/** 취소 응답 = 주문 응답. 화면은 환불 금액만 씁니다 */
interface ApiTicketOrder {
  ticketOrderId: number;
  totalAmount: number;
}

/* ── 어댑터 (서버 → 화면) ───────────────────────────────────── */

const toTicket = (api: ApiTicket): Ticket => ({
  id: String(api.ticketId),
  status: api.status,
  concertTitle: api.title,
  posterUrl: api.posterUrl ?? null,
  performanceNum: api.performanceNum,
  startAt: api.performanceDate,
  venueName: api.stadiumName,
  venueAddress: api.stadiumAddress,
  sectionName: api.areaCode,
  row: api.rowLabel ?? null,
  number: api.seatNumber ?? null,
  nftStatus: api.nftStatus ?? null,
  tokenId: api.tokenId ?? null,
  bookedAt: api.bookedAt,
  orderId: api.ticketOrderId == null ? null : String(api.ticketOrderId),
  price: api.totalAmount ?? null,
});

export interface CancelResult {
  orderId: string;
  /** 돌려받을 금액. **입금은 아직 안 끝났습니다** (아래 cancel 주석 참고) */
  refundAmount: number;
}

/* ── 호출 ───────────────────────────────────────────────────── */

export const ticketApi = {
  /** 내 티켓 목록. 최신 예매순이고, 취소된 예매도 함께 옵니다 */
  list: () => http.get<ApiTicket[]>('/users/me/tickets').then((list) => list.map(toTicket)),

  /**
   * 특정 회원의 티켓 (어드민 회원 상세).
   *
   * 🔴 <b>여기 두는 이유</b> — 서버 응답 형태(`ApiTicket`)를 아는 곳이 이 파일 하나여야 합니다.
   * 어드민 쪽에서 `http.get<Ticket[]>` 로 바로 부르면 타입만 맞고 **필드 이름이 달라
   * 화면에서 undefined 가 됩니다.** 실제로 그렇게 냈다가 `formatDateTime(undefined)` 이
   * `RangeError` 를 던져 회원 상세가 통째로 "문제가 발생했어요" 로 떨어졌습니다
   * (티켓이 있는 회원만 — 없으면 빈 목록이라 지나갔습니다).
   *
   * 응답은 `/users/me/tickets` 와 같은 DTO 라 어댑터도 그대로 씁니다.
   */
  ofUser: (userId: number) =>
    http.get<ApiTicket[]>(`/admin/users/${userId}/tickets`).then((list) => list.map(toTicket)),

  detail: (ticketId: string) =>
    http.get<ApiTicket>(`/users/me/tickets/${ticketId}`).then(toTicket),

  /**
   * 게이트에 보여줄 QR 문자열.
   *
   * 🔴 **본인 티켓만 받을 수 있습니다** (서버가 소유자를 검사합니다). 이 문자열이 곧
   * 입장권이라, 남의 것을 받아 갈 수 있으면 서명을 붙인 의미가 없습니다.
   */
  qr: (ticketId: string) =>
    http.get<ApiTicketQr>(`/users/me/tickets/${ticketId}/qr`).then((res) => res.token),

  /**
   * 예매 취소.
   *
   * 🔴 **티켓 ID 가 아니라 주문 ID 로 겁니다** (`Ticket.orderId`).
   *
   * 응답이 오면 예매는 이미 무효화됐고 좌석도 풀렸습니다. 환불(카드 취소 · 캣머니 환급 ·
   * NFT 소각)은 그 뒤에 비동기로 진행되고, **아직 안 끝났어도 취소는 성공입니다** —
   * 서버가 끝까지 재시도하므로 실패로 보여주면 안 됩니다.
   */
  cancel: (orderId: string) =>
    http
      .post<ApiTicketOrder>(`/payments/ticket-orders/${orderId}/cancel`)
      .then((order) => ({ orderId: String(order.ticketOrderId), refundAmount: order.totalAmount })),
};

export const ticketKeys = {
  all: ['ticket'] as const,
  list: () => [...ticketKeys.all, 'list'] as const,
  detail: (ticketId: string) => [...ticketKeys.all, 'detail', ticketId] as const,
  qr: (ticketId: string) => [...ticketKeys.all, 'qr', ticketId] as const,
};
