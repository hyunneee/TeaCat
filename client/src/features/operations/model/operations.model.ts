import type {
  OperationsArea,
  OperationsAttendee,
  OperationsCheckInFilter,
  OperationsSeat,
  OperationsSeatState,
} from './operations.types';

/**
 * 좌석 색은 **토큰**입니다 (`styles/index.css` 의 `--color-seat-*`).
 *
 * 🔴 화면 코드에 색을 적지 마세요 — 좌석 색은 예매 화면과 같은 다섯 줄에 모여 있어서
 *    거기만 고치면 두 화면이 함께 따라옵니다 (DESIGN.md 1장).
 *
 * 입장 완료만 예매 완료와 달라야 해서 강조색(`selected`)을 씁니다 — "지금 확인된 것" 이라
 * 강조색을 쓰는 세 자리 중 하나에 해당합니다.
 */
export const OPERATIONS_SEAT_FILL: Record<OperationsSeatState, string> = {
  AVAILABLE: 'fill-seat-available',
  HELD: 'fill-seat-held',
  BOOKED: 'fill-seat-sold',
  CHECKED_IN: 'fill-seat-selected',
  BLOCKED: 'fill-seat-blocked',
};

export const OPERATIONS_SEAT_LABEL: Record<OperationsSeatState, string> = {
  AVAILABLE: '빈자리',
  HELD: '결제 진행 중',
  BOOKED: '예매 완료',
  CHECKED_IN: '입장 완료',
  BLOCKED: '판매 제외',
};

/** 범례 순서 — 운영자가 자주 보는 것부터 */
export const OPERATIONS_SEAT_LEGEND: OperationsSeatState[] = [
  'BOOKED',
  'CHECKED_IN',
  'HELD',
  'AVAILABLE',
  'BLOCKED',
];

export const CHECK_IN_FILTER_LABEL: Record<OperationsCheckInFilter, string> = {
  ALL: '전체',
  CHECKED_IN: '입장 완료',
  NOT_CHECKED_IN: '미입장',
};

/** 눌러서 상세를 열 수 있는 좌석인가 — 티켓이 있는 자리만 */
export function hasTicket(seat: OperationsSeat): boolean {
  return seat.ticketId != null;
}

/** 'A구역 3열 12번' / 스탠딩이면 'A구역 스탠딩' */
export function seatText(attendee: OperationsAttendee): string {
  if (attendee.rowLabel === null || attendee.seatNumber === null) {
    return `${attendee.areaCode}구역 스탠딩`;
  }
  return `${attendee.areaCode}구역 ${attendee.rowLabel}열 ${attendee.seatNumber}번`;
}

/** 'A구역 3열 12번' — 좌석맵에서 고른 자리 */
export function seatLabel(areaCode: string, seat: OperationsSeat): string {
  if (seat.rowLabel === null || seat.seatNumber === null) return `${areaCode}구역`;
  return `${areaCode}구역 ${seat.rowLabel}열 ${seat.seatNumber}번`;
}

/**
 * 스탠딩 구역인가.
 *
 * 🔴 `seats.length === 0` 으로 판단하지 마세요 — 좌석을 아직 만들지 않은 좌석제 구역도
 *    빈 배열입니다. 둘을 섞으면 "정원만 보여주는" 안내가 엉뚱한 구역에 붙습니다.
 */
export function isStanding(area: OperationsArea): boolean {
  return area.saleType === 'STANDING';
}

/** 입장률(0~1). 예매가 없으면 0 — 0 으로 나누지 않습니다 */
export function checkInRatio(booked: number, checkedIn: number): number {
  return booked === 0 ? 0 : checkedIn / booked;
}

/**
 * 좌석맵에 그릴 구역만 남깁니다.
 *
 * 좌표가 없는 구역은 SVG 에 그릴 수 없습니다. 스탠딩은 정원 카드로 따로 보여주므로
 * 여기서 빠집니다.
 */
export function mappableAreas(areas: OperationsArea[]): OperationsArea[] {
  return areas.filter((area) => !isStanding(area) && area.seats.length > 0);
}

export function standingAreas(areas: OperationsArea[]): OperationsArea[] {
  return areas.filter(isStanding);
}
