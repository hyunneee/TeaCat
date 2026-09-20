/**
 * 운영 콘솔 "좌석·예매자" 의 서버 계약.
 *
 * 경로는 `/admin/performances/{performanceId}/schedules/{scheduleId}/operations/*` 입니다.
 * 🔴 **공개 좌석맵(`/schedules/{id}/seats`)과 다른 응답입니다.** 공개 쪽은 1초 캐시를 모든
 * 관람객이 공유하므로 운영 정보를 섞지 않습니다 — 타입도 합치지 마세요.
 */

/** 운영자가 보는 좌석 상태. 예매 상태와 입장 여부를 합친 한 칸입니다 */
export type OperationsSeatState = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'CHECKED_IN' | 'BLOCKED';

export type OperationsSaleType = 'SEATED' | 'STANDING';

/** 예매 자체의 상태. 입장 여부는 `checkedInAt` 이라는 다른 축입니다 */
export type OperationsTicketStatus = 'CONFIRMED' | 'CANCELLED';

/** 명단의 입장 상태 필터. 서버 enum 과 같은 값이어야 합니다 */
export type OperationsCheckInFilter = 'ALL' | 'CHECKED_IN' | 'NOT_CHECKED_IN';

export interface OperationsSeat {
  seatId: number;
  rowLabel: string | null;
  seatNumber: number | null;
  seatX: number | null;
  seatY: number | null;
  state: OperationsSeatState;
  /** 예매된 좌석만. 이 번호로 상세를 조회합니다 */
  ticketId?: number | null;
}

export interface OperationsArea {
  areaId: number;
  areaCode: string;
  saleType: OperationsSaleType;
  grade: string | null;
  price: number | null;
  areaX: number | null;
  areaY: number | null;
  width: number | null;
  height: number | null;
  /** 좌석제는 판매 좌석 수, 스탠딩은 최대 판매 수량 */
  capacity: number;
  bookedCount: number;
  checkedInCount: number;
  /** 🔴 스탠딩 구역은 **빈 배열**입니다 — 없는 자리 번호를 만들지 않습니다 */
  seats: OperationsSeat[];
}

export interface OperationsSummary {
  bookedCount: number;
  checkedInCount: number;
  notCheckedInCount: number;
  /** 지금 결제 진행 중인 좌석 수 */
  heldCount: number;
}

export interface OperationsSeatMap {
  performanceId: number;
  performanceTitle: string;
  scheduleId: number;
  performanceNum: number;
  performanceDate: string;
  /** 이 응답을 만든 서버 시각. 화면의 '마지막 갱신' 이 씁니다 */
  serverTime: string;
  summary: OperationsSummary;
  areas: OperationsArea[];
}

/**
 * 명단 한 줄 = 티켓 한 장.
 *
 * 🔴 이름·연락처는 **서버가 가려서** 보냅니다(`홍*동`, `010-****-5678`).
 * 화면에서 다시 가리려 하거나, 가려지지 않은 값을 기대하지 마세요.
 */
export interface OperationsAttendee {
  ticketId: number;
  areaId: number;
  areaCode: string;
  /** 스탠딩이면 null */
  seatId: number | null;
  rowLabel: string | null;
  seatNumber: number | null;
  holderName: string | null;
  holderNickname: string;
  holderPhone: string | null;
  status: OperationsTicketStatus;
  bookedAt: string;
  /** 아직 입장하지 않았으면 null */
  checkedInAt: string | null;
}

export interface OperationsAttendeePage {
  items: OperationsAttendee[];
  nextCursor: string | null;
  hasNext: boolean;
  /** 필터를 적용한 전체 명단 수 */
  totalCount: number;
}

export interface OperationsAttendeeDetail {
  attendee: OperationsAttendee;
  performanceId: number;
  performanceTitle: string;
  scheduleId: number;
  performanceNum: number;
  performanceDate: string;
  grade: string | null;
}

/** 명단 조회 조건. 쿼리 키에 그대로 들어갑니다 */
export interface AttendeeQuery {
  keyword: string;
  areaId: number | null;
  checkIn: OperationsCheckInFilter;
}
