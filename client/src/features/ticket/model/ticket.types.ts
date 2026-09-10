/**
 * 티켓 도메인 타입.
 *
 * 서버 응답(`GET /users/me/tickets`)을 그대로 쓰지 않고 화면이 쓰기 좋은 모양으로
 * 한 번 옮깁니다 (변환은 `api/ticketApi.ts` 의 어댑터 한곳).
 */

/** 예매 상태. 서버 `ticket_status` ENUM 과 같습니다 */
export type TicketStatus = 'CONFIRMED' | 'CANCELLED';

/**
 * NFT 티켓 발행 상태 — 예매 상태와 **다른 축**입니다.
 * `PENDING`/`MINTING`/`FAILED` 여도 예매는 유효하니 실패로 보여주지 마세요.
 */
export type NftStatus = 'PENDING' | 'MINTING' | 'MINTED' | 'BURNED' | 'FAILED';

export interface Ticket {
  /** 서버 ticketId */
  id: string;
  /**
   * 이 티켓을 만든 주문.
   *
   * 🔴 **결제 금액과 예매 취소가 여기 걸려 있습니다.** 티켓 응답에는 금액이 없고,
   *    취소도 `POST /payments/ticket-orders/{orderId}/cancel` 입니다.
   *    결제를 거치지 않고 만들어진 티켓이면 null 이라 취소 버튼을 걸 수 없습니다.
   */
  orderId: number | null;
  status: TicketStatus;

  concertTitle: string;
  /** 서버가 발급한 임시 URL — 유효시간이 있어 **캐시하지 마세요** */
  posterUrl: string | null;
  performanceNum: number;
  /** 공연 일시 */
  startAt: string;

  venueName: string;
  venueAddress: string;

  sectionName: string;
  /** 스탠딩이면 null */
  row: string | null;
  number: number | null;

  nftStatus: NftStatus | null;
  /** 온체인 토큰 번호. 발행 확정 전에는 null */
  tokenId: string | null;
  bookedAt: string;
}
