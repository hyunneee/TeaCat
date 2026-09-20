import { memo } from 'react';
import { cn, FULL_VENUE, STAGE_LINE_RATIO, seatSizeOf, viewBoxOf } from '@/shared/lib';
import { SEAT_FILL, isSelectable } from '../model/seat.model';
import type { Seat } from '../model/booking.types';

interface SeatMapProps {
  seats: Seat[];
  selectedSeatIds: readonly string[];
  onSelect: (seat: Seat) => void;
  /** 좌석 블록만 보이도록 뷰박스를 자동으로 맞춥니다 */
  fitToSeats?: boolean;
}

/* 좌석 크기·뷰박스 계산은 `shared/lib/seatGeometry` 에 있습니다 —
   운영 좌석맵(`features/operations`)이 같은 계산을 쓰기 때문입니다. */

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

  /* 무대 표시는 뷰박스의 가로 중앙에 놓습니다. 퍼센트가 아니라 사용자 좌표로 계산하는
     이유는 아래 무대 표시 주석에 있습니다 */
  const stageCenterX = view.minX + view.width / 2;
  const stageLineWidth = view.width * STAGE_LINE_RATIO;

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
        {/* 무대 방향 표시 — 뷰박스 상단 기준이라 어느 구역을 봐도 보입니다.
            🔴 x 를 퍼센트로 주면 안 됩니다. SVG 퍼센트는 뷰박스 **너비에만** 비례하고
               `min-x` 를 더하지 않습니다. 뷰박스는 고른 구역에 맞춰 잘라내므로 minX 가
               0 이 아니고(지금 데이터에서 89.6), 그만큼 무대 표시가 왼쪽으로 쏠렸습니다
               — 너비의 14% 라 "살짝 비뚤어진" 것으로 보입니다.
               y 는 처음부터 `view.minY` 를 더해 쓰고 있었는데 x 만 빠져 있었습니다. */}
        <text
          x={stageCenterX}
          y={view.minY + seatSize * 1.3}
          textAnchor="middle"
          style={{ fontSize: seatSize * 0.9 }}
          className="fill-[var(--color-ink-subtle)] font-bold tracking-[0.35em]"
        >
          STAGE
        </text>
        <rect
          x={stageCenterX - stageLineWidth / 2}
          y={view.minY + seatSize * 1.9}
          width={stageLineWidth}
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
                selectable
                  ? 'cursor-pointer hover:scale-110 hover:opacity-80'
                  : 'cursor-not-allowed',
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
