/**
 * 내 티켓 도메인 타입.
 *
 * 서버 응답을 그대로 쓰지 않고 화면이 쓰기 좋은 모양으로 한 번 옮깁니다
 * (변환은 `api/ticketApi.ts` 의 어댑터 한곳). booking 과 같은 방식입니다.
 */

/**
 * 예매 상태. 서버 `ticket_status` ENUM 과 같습니다.
 *
 * 🔴 **"입장 완료" 같은 상태는 없습니다.** 예전 목업에는 `USED` 가 있었지만 서버는 입장 여부를
 *    티켓에 기록하지 않습니다. 관람이 끝났는지는 상태가 아니라 **공연 일시로 판단합니다**
 *    (`isPast`).
 */
export type TicketStatus = 'CONFIRMED' | 'CANCELLED';

/**
 * NFT(SBT) 발행 상태.
 *
 * 🔴 **예매 상태와 다른 축입니다.** 발행이 `PENDING`/`MINTING`/`FAILED` 여도 예매는 유효합니다.
 *    체인 확정에 보통 10초쯤 걸리므로, 이 값으로 "예매 실패" 를 보여주면 안 됩니다.
 */
export type NftStatus = 'PENDING' | 'MINTING' | 'MINTED' | 'BURNED' | 'FAILED';

export interface Ticket {
  id: string;
  status: TicketStatus;

  concertTitle: string;
  /** 서버가 발급한 임시 URL. **유효시간이 있어 캐시하면 안 됩니다.** 없으면 null */
  posterUrl: string | null;
  /** 회차 번호 */
  performanceNum: number;
  /** 공연 일시(ISO) */
  startAt: string;

  venueName: string;
  venueAddress: string;

  sectionName: string;
  /** 스탠딩 구역이면 null */
  row: string | null;
  /** 스탠딩 구역이면 null */
  number: number | null;

  nftStatus: NftStatus | null;
  /** 온체인 토큰 번호. 발행 확정 전에는 null */
  tokenId: string | null;

  /** 예매 시각(ISO) */
  bookedAt: string;

  /**
   * 이 티켓을 발권한 주문.
   *
   * 🔴 **취소에 필요합니다.** 취소는 티켓이 아니라 주문 단위입니다
   *    (`POST /payments/ticket-orders/{orderId}/cancel`). 주문을 못 찾은 티켓은 null 이고,
   *    그때는 취소 버튼을 보여주지 않습니다 (`isCancelable`).
   */
  orderId: string | null;
  /** 결제한 금액(원). 주문을 못 찾으면 null */
  price: number | null;
}
