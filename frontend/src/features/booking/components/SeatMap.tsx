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

const SEAT_SIZE = 14;
const PADDING = 40;

function viewBoxOf(seats: Seat[]) {
  if (seats.length === 0) return '0 0 1000 700';

  const xs = seats.map((s) => s.x);
  const ys = seats.map((s) => s.y);
  const minX = Math.min(...xs) - PADDING;
  const minY = Math.min(...ys) - PADDING;
  const width = Math.max(...xs) + SEAT_SIZE + PADDING - minX;
  const height = Math.max(...ys) + SEAT_SIZE + PADDING - minY;

  return `${minX} ${minY} ${width} ${height}`;
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
  return (
    <svg
      viewBox={fitToSeats ? viewBoxOf(seats) : '0 0 1000 700'}
      className="no-select h-full w-full touch-pan-x touch-pan-y"
      role="group"
      aria-label="좌석 배치도"
    >
      {/* 무대 방향 표시 */}
      <text
        x="50%"
        y="14"
        textAnchor="middle"
        className="fill-[var(--color-ink-subtle)] text-[13px] font-bold tracking-[0.35em]"
      >
        STAGE
      </text>
      <rect x="18%" y="24" width="64%" height="2" rx="1" className="fill-[var(--color-line-strong)]" />

      {seats.map((seat) => {
        const selected = selectedSeatIds.includes(seat.id);
        const selectable = isSelectable(seat);

        return (
          <rect
            key={seat.id}
            x={seat.x}
            y={seat.y}
            width={SEAT_SIZE}
            height={SEAT_SIZE}
            rx={3.5}
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
  );
}

/**
 * 3초마다 폴링이 돌기 때문에, 좌석 배열이 그대로면 리렌더를 건너뜁니다.
 * (좌석 수천 개 × 3초마다 재렌더 = 프레임 드랍)
 */
export const SeatMap = memo(SeatMapImpl);
