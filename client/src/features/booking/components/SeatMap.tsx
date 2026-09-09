import { memo } from 'react';
import { cn } from '@/shared/lib';
import { SEAT_FILL, isSelectable } from '../model/seat.model';
import type { Seat } from '../model/booking.types';

interface SeatMapProps {
  seats: Seat[];
  selectedSeatIds: readonly string[];
  onSelect: (seat: Seat) => void;
  /** 좌석 블록만 보이도록 뷰박스를 자동으로 맞춥니다 */
  fitToSeats?: boolean;
}

/**
 * 좌석 사각형의 한 변.
 *
 * 🔴 고정값을 쓰면 안 됩니다. 좌석 좌표는 공연장 도면 좌표계로 오고, 그 간격은
 *    공연장마다 다릅니다 (지금 데이터는 좌석 간격이 63). 14 같은 상수를 쓰면
 *    간격이 넓은 도면에서는 좌석이 점처럼 작아져 손가락으로 누를 수 없습니다.
 *    실제 좌석 간격에서 계산합니다.
 */
function seatSizeOf(seats: Seat[]): number {
  const gap = smallestGap(seats);
  // 간격의 70% — 좌석 사이에 경계가 보일 만큼만 띄웁니다
  return gap * 0.7;
}

/** 인접 좌석 사이의 가장 작은 간격 (x·y 중 더 촘촘한 쪽) */
function smallestGap(seats: Seat[]): number {
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

  const gap = Math.min(
    gapOf(seats.map((s) => s.x)),
    gapOf(seats.map((s) => s.y)),
  );

  return Number.isFinite(gap) && gap > 0 ? gap : FALLBACK;
}

/** 뷰박스 여백 — 좌석 크기에 비례해야 도면이 바뀌어도 균형이 유지됩니다 */
const PADDING_RATIO = 1.2;
/** 좌석 위쪽에 무대 표시를 넣을 띠 (좌석 크기 배수) */
const STAGE_BAND_RATIO = 2.4;

interface ViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

const FULL_VENUE: ViewBox = { minX: 0, minY: 0, width: 1000, height: 700 };

/**
 * 좌석이 차지하는 사각형에 뷰박스를 맞춥니다.
 *
 * 🔴 위쪽에 `STAGE_BAND` 만큼 여백을 더 둡니다. 무대 표시를 고정 좌표(y=14)에
 *    그리면, 공연장 도면에서 아래쪽에 있는 구역(예: BACK 은 y가 900 이상)을 볼 때
 *    뷰박스 밖이라 잘려서 무대 방향을 알 수 없게 됩니다.
 */
function viewBoxOf(seats: Seat[], seatSize: number): ViewBox {
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

/**
 * 순수 View.
 *
 * 이 컴포넌트는 API 도 스토어도 모릅니다. props 로 받은 것만 그립니다.
 * 덕분에 좌석 규칙이 바뀌어도(1인 4매 → 1매) 여기는 손댈 일이 없습니다.
 *
 * ⚠️ 여기는 티켓팅의 심장입니다. 좌석 하나에 motion 컴포넌트를 붙이면
 *    수천 개 × 3초 폴링에서 프레임이 무너집니다. CSS transition 만 씁니다.
 */
function SeatMapImpl({ seats, selectedSeatIds, onSelect, fitToSeats = true }: SeatMapProps) {
  const seatSize = seatSizeOf(seats);
  const view = fitToSeats ? viewBoxOf(seats, seatSize) : FULL_VENUE;

  return (
    /* 🔴 여기에 h-full(height:100%) 을 쓰면 안 됩니다.
          부모가 flex 아이템(flex-1)이면 퍼센트 높이가 해결되지 않아 auto 로
          떨어지고, 동시에 height 가 auto 가 아니게 되어 align-items:stretch 도
          적용되지 않습니다. 결과는 종횡비만큼의 얇은 띠 —
          가로로 긴 구역이 532px 자리에 145px 로 그려져 좌석이 손가락보다 작아집니다.
          높이를 비워 두고 부모(flex)의 stretch 가 늘려주게 맡깁니다.
          ⚠️ 부모 컨테이너에 `flex` 가 있어야 동작합니다 (SeatSelectPage). */
    <div className="flex min-h-0 w-full">
      <svg
        viewBox={`${view.minX} ${view.minY} ${view.width} ${view.height}`}
        className="no-select min-h-0 w-full flex-1 touch-pan-x touch-pan-y"
        role="group"
        aria-label="좌석 배치도"
      >
        {/* 무대 방향 표시 — 뷰박스 상단 기준이라 어느 구역을 봐도 보입니다 */}
        <text
          x="50%"
          y={view.minY + seatSize * 1.3}
          textAnchor="middle"
          style={{ fontSize: seatSize * 0.9 }}
          className="fill-[var(--color-ink-subtle)] font-bold tracking-[0.35em]"
        >
          STAGE
        </text>
        <rect
          x="18%"
          y={view.minY + seatSize * 1.9}
          width="64%"
          height={Math.max(seatSize * 0.1, 1.5)}
          rx="1"
          className="fill-[var(--color-line-strong)]"
        />

        {seats.map((seat) => {
          const selected = selectedSeatIds.includes(seat.id);
          const selectable = isSelectable(seat);

          return (
            <rect
              key={seat.id}
              x={seat.x}
              y={seat.y}
              width={seatSize}
              height={seatSize}
              rx={seatSize * 0.25}
              role="button"
              tabIndex={selectable ? 0 : -1}
              aria-label={`${seat.row}열 ${seat.number}번`}
              aria-pressed={selected}
              aria-disabled={!selectable}
              onClick={() => onSelect(seat)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(seat);
                }
              }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              className={cn(
                'transition-[fill,opacity,transform] duration-150',
                selected ? 'fill-seat-selected scale-115' : SEAT_FILL[seat.status],
                selectable ? 'cursor-pointer hover:scale-110 hover:opacity-80' : 'cursor-not-allowed',
                seat.status === 'SOLD' && 'opacity-55',
                seat.status === 'BLOCKED' && 'opacity-35',
              )}
            />
          );
        })}
      </svg>
    </div>
  );
}

/**
 * 3초마다 폴링이 돌기 때문에, 좌석 배열이 그대로면 리렌더를 건너뜁니다.
 * (좌석 수천 개 × 3초마다 재렌더 = 프레임 드랍)
 */
export const SeatMap = memo(SeatMapImpl);
