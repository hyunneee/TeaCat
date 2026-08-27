/** 좌석의 실시간 상태 */
export type SeatStatus =
  | 'AVAILABLE' // 구매 가능
  | 'HELD' // 다른 사람이 결제 진행 중 (서버 락)
  | 'SOLD' // 판매 완료
  | 'BLOCKED'; // 시야제한 / 취소표 추첨 대기 중

export interface Section {
  id: string;
  name: string;
  grade: string;
  price: number;
  totalSeats: number;
  availableSeats: number;
  /** 좌석맵 블록 배치 (구역 미리보기용) */
  origin: { x: number; y: number };
  cols: number;
  rows: number;
}

export interface Seat {
  id: string;
  sectionId: string;
  /** 화면 표기용 — 'A구역 12열 5번' */
  row: string;
  number: number;
  price: number;
  status: SeatStatus;
  /** 좌석맵 SVG 상의 좌표 */
  x: number;
  y: number;
}

export interface SeatMapData {
  scheduleId: string;
  /** 서버가 알려주는 이 회차의 1인 최대 구매 매수 */
  maxPerUser: number;
  sections: { id: string; name: string; grade: string; price: number }[];
  seats: Seat[];
}

/** 좌석 선점(락) 결과 */
export interface SeatHold {
  holdId: string;
  scheduleId: string;
  seatIds: string[];
  /** 서버 기준 만료 시각(ISO). 클라이언트 시계를 믿지 않습니다. */
  expiresAt: string;
}

export interface HoldDetail extends SeatHold {
  seats: { id: string; sectionName: string; row: string; number: number; price: number }[];
}

/** 좌석 하나당 티켓을 받을 사람 */
export interface Recipient {
  seatId: string;
  loginId: string;
}

export interface CreateOrderRequest {
  holdId: string;
  /** 단순 양도 방지 — 결제 시점에 티켓을 받을 사람의 아이디를 확정 */
  recipients: Recipient[];
}

export interface Order {
  orderId: string;
  ticketIds: string[];
  totalPrice: number;
  paidAt: string;
}
