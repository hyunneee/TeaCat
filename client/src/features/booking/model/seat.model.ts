import type { Seat, SeatStatus, Section } from './booking.types';

/**
 * 좌석 선택 규칙 (순수 도메인 로직).
 *
 * 컴포넌트가 아니라 여기 모아둡니다. 이유:
 *  - 규칙이 바뀌어도 (1인 4매 → 1인 1매) 화면 코드를 안 건드립니다
 *  - 렌더링 없이 테스트할 수 있습니다
 */

export function isSelectable(seat: Seat): boolean {
  // 가격이 없으면 결제 금액을 정할 수 없습니다. 고르게 두면 다음 화면에서 막힙니다
  return seat.status === 'AVAILABLE' && seat.price !== null;
}

export type SelectionError = 'LIMIT_EXCEEDED' | 'NOT_SELECTABLE' | null;

/** 좌석을 하나 더 고를 수 있는지 판정 */
export function validateSelection(
  seat: Seat,
  selectedIds: readonly string[],
  maxPerUser: number,
): SelectionError {
  // 이미 고른 좌석을 다시 누르는 건 "해제"이므로 항상 허용
  if (selectedIds.includes(seat.id)) return null;
  if (!isSelectable(seat)) return 'NOT_SELECTABLE';
  if (selectedIds.length >= maxPerUser) return 'LIMIT_EXCEEDED';
  return null;
}

export function totalPrice(seats: Seat[], selectedIds: readonly string[]): number {
  return seats
    .filter((s) => selectedIds.includes(s.id))
    .reduce((sum, s) => sum + (s.price ?? 0), 0);
}

/** 'VIP석 12열 5번' */
export function seatLabel(seat: Seat, sectionName: string): string {
  return `${sectionName} ${seat.row}열 ${seat.number}번`;
}

/** 구역 잔여율 (0~1) */
export function sectionRemainRatio(section: Section): number {
  return section.totalSeats === 0 ? 0 : section.availableSeats / section.totalSeats;
}

export function isSectionSoldOut(section: Section): boolean {
  return section.availableSeats === 0;
}

/**
 * 이 구역을 고를 수 있는가.
 *
 * 🔴 가격이 null 인 구역은 관리자가 공연-구역 설정에서 등급·가격을 넣지 않은
 *    상태입니다. 결제 금액을 정할 수 없으므로 예매를 막고 안내합니다.
 */
export function isSectionBookable(section: Section): boolean {
  return !isSectionSoldOut(section) && section.price !== null;
}

/** 가격 표기. 미설정 구역은 금액 대신 상태를 보여줍니다 */
export function priceLabel(price: number | null): string {
  return price === null ? '가격 미정' : `${price.toLocaleString('ko-KR')}원`;
}

/** 좌석 상태 → Tailwind fill 클래스. 색은 styles/index.css 의 --color-seat-* 에서 관리합니다. */
export const SEAT_FILL: Record<SeatStatus, string> = {
  AVAILABLE: 'fill-seat-available',
  HELD: 'fill-seat-held',
  SOLD: 'fill-seat-sold',
  BLOCKED: 'fill-seat-blocked',
};

export const SEAT_STATUS_LABEL: Record<SeatStatus, string> = {
  AVAILABLE: '선택 가능',
  HELD: '결제 진행 중',
  SOLD: '판매 완료',
  BLOCKED: '추첨 대기',
};
