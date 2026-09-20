/**
 * 좌석 도면의 자리 계산 — **좌표만 아는 순수 함수들**.
 *
 * 예매 좌석맵과 운영 좌석맵이 같은 계산을 씁니다. 두 화면은 상태도 색도 다르지만
 * "좌석 간격에서 크기를 구하고 좌석이 차지한 사각형에 뷰박스를 맞춘다" 는 같습니다.
 * 한쪽만 고치면 같은 도면이 두 화면에서 다르게 보이므로 여기 한곳에 둡니다.
 *
 * 🔴 여기는 좌석이 무엇인지 모릅니다(`shared` 규칙). 받는 것은 x·y 뿐입니다.
 */

export interface SeatPoint {
  x: number;
  y: number;
}

export interface ViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/** 좌석이 없을 때의 기본 뷰박스 — 공연장 도면 전체 */
export const FULL_VENUE: ViewBox = { minX: 0, minY: 0, width: 1000, height: 700 };

/** 뷰박스 여백 — 좌석 크기에 비례해야 도면이 바뀌어도 균형이 유지됩니다 */
const PADDING_RATIO = 1.2;
/** 좌석 위쪽에 무대 표시를 넣을 띠 (좌석 크기 배수) */
export const STAGE_BAND_RATIO = 2.4;
/** 무대 밑줄이 뷰박스 너비에서 차지하는 비율 (양옆으로 18% 씩 남깁니다) */
export const STAGE_LINE_RATIO = 0.64;

/**
 * 좌석 사각형의 한 변.
 *
 * 🔴 고정값을 쓰면 안 됩니다. 좌석 좌표는 공연장 도면 좌표계로 오고, 그 간격은
 *    공연장마다 다릅니다 (지금 데이터는 좌석 간격이 63). 14 같은 상수를 쓰면
 *    간격이 넓은 도면에서는 좌석이 점처럼 작아져 손가락으로 누를 수 없습니다.
 *    실제 좌석 간격에서 계산합니다.
 */
export function seatSizeOf(seats: SeatPoint[]): number {
  // 간격의 70% — 좌석 사이에 경계가 보일 만큼만 띄웁니다
  return smallestGap(seats) * 0.7;
}

/** 인접 좌석 사이의 가장 작은 간격 (x·y 중 더 촘촘한 쪽) */
function smallestGap(seats: SeatPoint[]): number {
  const FALLBACK = 20;
  if (seats.length < 2) return FALLBACK;

  const gapOf = (values: number[]) => {
    const sorted = [...new Set(values)].sort((a, b) => a - b);
    let min = Infinity;
    for (let i = 1; i < sorted.length; i += 1) {
      min = Math.min(min, (sorted[i] as number) - (sorted[i - 1] as number));
    }
    return min;
  };

  const gap = Math.min(gapOf(seats.map((s) => s.x)), gapOf(seats.map((s) => s.y)));

  return Number.isFinite(gap) && gap > 0 ? gap : FALLBACK;
}

/**
 * 좌석이 차지하는 사각형에 뷰박스를 맞춥니다.
 *
 * 🔴 위쪽에 무대 띠만큼 여백을 더 둡니다. 무대 표시를 고정 좌표(y=14)에 그리면,
 *    공연장 도면에서 아래쪽에 있는 구역(예: BACK 은 y가 900 이상)을 볼 때 뷰박스 밖이라
 *    잘려서 무대 방향을 알 수 없게 됩니다.
 */
export function viewBoxOf(seats: SeatPoint[], seatSize: number): ViewBox {
  if (seats.length === 0) return FULL_VENUE;

  const padding = seatSize * PADDING_RATIO;
  const stageBand = seatSize * STAGE_BAND_RATIO;

  const xs = seats.map((s) => s.x);
  const ys = seats.map((s) => s.y);
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding - stageBand;

  return {
    minX,
    minY,
    width: Math.max(...xs) + seatSize + padding - minX,
    height: Math.max(...ys) + seatSize + padding - minY,
  };
}
