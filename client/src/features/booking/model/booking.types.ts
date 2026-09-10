/**
 * 예매 도메인 타입.
 *
 * 서버 응답을 그대로 쓰지 않고 화면이 쓰기 좋은 모양으로 한 번 옮깁니다
 * (변환은 `api/bookingApi.ts` 의 어댑터 한곳). 서버가 회차를 두 이름으로
 * 부르고 있어서(`scheduleId` / `performanceDetailId`) 그걸 화면까지
 * 흘려보내지 않기 위해서입니다 — 프론트는 `scheduleId` 하나만 씁니다.
 */

/** 좌석의 실시간 상태. 서버 `seat_booking_status` ENUM 과 같습니다. */
export type SeatStatus =
  | 'AVAILABLE' // 구매 가능
  | 'HELD' // 다른 사람이 결제 진행 중 (서버 락)
  | 'SOLD' // 판매 완료
  | 'BLOCKED'; // 시야제한 / 취소표 추첨 대기 중

/**
 * 구역. 서버의 공연장 구역(area) + 공연별 설정(등급·가격)을 합친 것입니다.
 *
 * 🔴 `grade` 와 `price` 는 **null 일 수 있습니다.** 관리자가 공연-구역 설정에서
 *    등급·가격을 넣지 않으면 서버가 null 로 내려줍니다. 가격이 없으면 결제 금액을
 *    정할 수 없으므로 그 구역은 **고를 수 없게** 막습니다 (`isSectionBookable`).
 */
export interface Section {
  /** 서버 areaId */
  id: string;
  /** 서버 areaCode — 'Front', 'A' 처럼 짧은 표기 */
  name: string;
  grade: string | null;
  price: number | null;
  totalSeats: number;
  availableSeats: number;
  /**
   * 팔 수 있는 상태로 준비된 좌석 수 (AVAILABLE + HELD + SOLD).
   *
   * 🔴 `totalSeats` 와 다릅니다. 회차 좌석을 아직 만들지 않았으면
   *    (`POST /admin/schedules/{id}/seats`) 서버가 전 좌석을 `BLOCKED` 로 내려주는데,
   *    그때 `totalSeats` 는 그대로고 이 값만 0 입니다. 이 둘을 구분하지 않으면
   *    **아직 열지 않은 구역이 "매진" 으로 보입니다.**
   */
  sellableSeats: number;
  /** 공연장 도면에서 이 구역이 차지하는 사각형 — 서버가 알려줍니다 */
  bounds: { x: number; y: number; width: number; height: number };
}

export interface Seat {
  /** 서버 seatId */
  id: string;
  /** 이 좌석이 속한 구역(areaId) */
  sectionId: string;
  /** 화면 표기용 — 'A구역 12열 5번' */
  row: string;
  number: number;
  /** 구역 가격에서 내려온 값. 구역에 가격이 없으면 null */
  price: number | null;
  status: SeatStatus;
  /** 좌석맵 SVG 상의 좌표 */
  x: number;
  y: number;
}

export interface SeatMapData {
  scheduleId: string;
  /**
   * 응답을 만든 시점의 **서버 시각**.
   * 클라이언트 시계가 어긋나도 남은 시간이 틀리지 않게 서버가 함께 줍니다.
   */
  serverTime: string;
  sections: Section[];
  seats: Seat[];
}

/**
 * 좌석 선점(락) 결과.
 *
 * 🔴 서버에는 **holdId 가 없습니다.** 선점의 키는 (회차, 좌석, 사용자)이고
 *    한 사용자는 회차당 좌석 하나만 선점합니다. 그래서 좌석 배열도 아닙니다.
 *
 * 🔴 남은 시간은 `remainingSeconds` 를 쓰세요. `expiresAt` 을 클라이언트 시계로
 *    다시 계산하면 기기 시각이 틀어진 사용자에게 엉뚱한 타이머가 보입니다.
 */
export interface SeatHold {
  scheduleId: string;
  seatId: string;
  status: SeatStatus;
  /** 서버 기준 만료 시각(ISO) — 표시용. 카운트다운은 remainingSeconds 로 */
  expiresAt: string;
  /** 서버(DB) 시계로 계산한 남은 초 */
  remainingSeconds: number;
}

/**
 * 내가 선점 중인 좌석. 결제 화면이 필요한 정보를 서버가 조립해서 줍니다.
 * (`GET /me/holds` — 1인 1매는 회차 단위라 회차가 다르면 여러 건이 나옵니다)
 */
export interface MyHold {
  scheduleId: string;
  seatId: string;
  expiresAt: string;
  remainingSeconds: number;
  concertTitle: string;
  posterUrl: string | null;
  performanceNum: number | null;
  performanceDate: string;
  stadiumName: string;
  sectionName: string;
  row: string;
  number: number;
  grade: string | null;
  price: number | null;
}

/** 서버 `GET /concerts/{id}/policy` */
export interface BookingPolicy {
  concertId: string;
  maxTicketsPerUser: number;
  companionRequired: boolean;
  faceVerificationRequired: boolean;
  cancelableUntilPerformanceStart: boolean;
}

/* ── 결제(목업) 전용 ────────────────────────────────────────────
   🔴 아래 타입들은 아직 **서버에 대응하는 API 가 없습니다.**
      `payment` · `ticket` 도메인이 백엔드에 없어서 결제는 목업으로 돕니다.
      실제 결제 API 가 나오면 그 응답에 맞춰 다시 정의하세요 —
      특히 `holdId` 는 서버에 없는 개념입니다 (store 의 HoldSession 주석 참고). */

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
