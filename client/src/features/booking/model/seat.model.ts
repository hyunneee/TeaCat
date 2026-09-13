import type { MyHold, Seat, SeatStatus, Section } from './booking.types';

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
  if (seat.type === 'STANDING') return `${sectionName} 스탠딩 입장권`;
  return `${sectionName} ${seat.row}열 ${seat.number}번`;
}

/**
 * 'A 12열 5번' — 내 선점 목록(`GET /me/holds`)용.
 *
 * {@link seatLabel} 과 결과는 같지만 재료가 다릅니다. 이쪽은 좌석맵 없이
 * 서버가 조립해 준 이름만 갖고 있어서 `Seat` 를 만들 수 없습니다.
 */
export function myHoldSeatLabel(hold: MyHold): string {
  if (hold.row === 'STANDING') return `${hold.sectionName} 스탠딩 입장권`;
  return `${hold.sectionName} ${hold.row}열 ${hold.number}번`;
}

/** 구역 잔여율 (0~1) */
export function sectionRemainRatio(section: Section): number {
  return section.totalSeats === 0 ? 0 : section.availableSeats / section.totalSeats;
}

export function isSectionSoldOut(section: Section): boolean {
  return section.availableSeats === 0 && section.sellableSeats > 0;
}

/**
 * 이 구역이 지금 어떤 상태인가. 배지 문구와 "고를 수 있는지" 가 여기서 함께 나옵니다.
 *
 * 🔴 **"매진" 과 "준비 중" 을 반드시 구분합니다.** 둘 다 남은 자리가 0 이지만 뜻이 정반대입니다.
 *    회차 좌석을 아직 만들지 않았으면(`POST /admin/schedules/{id}/seats`) 서버가 전 좌석을
 *    `BLOCKED` 로 주고, 그걸 매진이라고 쓰면 **운영자는 왜 안 팔리는지 영영 모릅니다.**
 *    실제로 그래서 "구역이 선택되지 않는다" 는 신고가 들어왔습니다.
 */
export type SectionAvailability =
  /** 고를 수 있음 */
  | 'ON_SALE'
  /** 팔 좌석은 있는데 남은 게 없음 */
  | 'SOLD_OUT'
  /** 좌석을 아직 만들지 않았거나(전 좌석 BLOCKED) 좌석이 없는 구역 */
  | 'PREPARING'
  /** 관리자가 등급·가격을 안 넣음 — 결제 금액을 정할 수 없어 팔 수 없음 */
  | 'NO_PRICE';

export function sectionAvailability(section: Section): SectionAvailability {
  // 가격이 먼저입니다. 자리가 남아 있어도 금액을 못 정하면 결제까지 갈 수 없습니다
  if (section.price === null) return 'NO_PRICE';
  // 좌석이 한 장도 준비되지 않음 — 좌석 미생성, 또는 좌석 없는 구역(스탠딩)
  if (section.sellableSeats === 0) return 'PREPARING';
  if (section.availableSeats === 0) return 'SOLD_OUT';
  return 'ON_SALE';
}

export const SECTION_AVAILABILITY_LABEL: Record<SectionAvailability, string> = {
  ON_SALE: '예매 가능',
  SOLD_OUT: '매진',
  PREPARING: '준비 중',
  NO_PRICE: '가격 미정',
};

/** 왜 못 고르는지. 고를 수 있으면 null — 화면이 이 문구를 그대로 보여줍니다 */
export function sectionBlockedReason(section: Section): string | null {
  switch (sectionAvailability(section)) {
    case 'SOLD_OUT':
      return '남은 자리가 없어요.';
    case 'PREPARING':
      return '아직 좌석이 열리지 않았어요.';
    case 'NO_PRICE':
      return '가격이 정해지지 않았어요.';
    default:
      return null;
  }
}

/**
 * 이 구역을 고를 수 있는가.
 *
 * 🔴 화면은 반드시 이걸 써야 합니다. 예전에는 `availableSeats === 0` 만 보고 막았는데,
 *    그러면 가격 없는 구역을 눌러 들어간 뒤 좌석 화면에서 전부 선택 불가가 됩니다.
 */
export function isSectionBookable(section: Section): boolean {
  return sectionAvailability(section) === 'ON_SALE';
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
