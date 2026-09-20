import { memo } from 'react';
import {
  cn,
  FULL_VENUE,
  STAGE_LINE_RATIO,
  seatSizeOf,
  viewBoxOf,
  type SeatPoint,
} from '@/shared/lib';
import { OPERATIONS_SEAT_FILL, OPERATIONS_SEAT_LABEL, hasTicket } from '../model/operations.model';
import type { OperationsArea, OperationsSeat } from '../model/operations.types';

interface Props {
  /** 그릴 구역들. 구역 필터가 걸려 있으면 한 구역만 옵니다 */
  areas: OperationsArea[];
  /** 지금 선택된 티켓. 그 자리를 도면에서 굵게 보여줍니다 */
  selectedTicketId: number | null;
  onSelectSeat: (seat: OperationsSeat, area: OperationsArea) => void;
}

/** 좌석과 그 좌석이 속한 구역을 함께 들고 다닙니다 — 눌렀을 때 구역 코드가 필요합니다 */
interface PlacedSeat extends SeatPoint {
  seat: OperationsSeat;
  area: OperationsArea;
}

/**
 * 운영 좌석맵 (순수 View).
 *
 * 예매 좌석맵(`features/booking` 의 `SeatMap`)과 **다른 컴포넌트**입니다. 상태가 다섯 가지고
 * (입장 완료가 더 있습니다) 고를 수 있는 자리의 기준도 반대입니다 — 여기서는 **팔린 자리**를
 * 눌러 예매자를 봅니다. 자리 계산만 `shared/lib/seatGeometry` 로 함께 씁니다.
 *
 * ⚠️ 좌석 하나하나에 motion 컴포넌트를 붙이지 마세요 — 수천 개 × 폴링이면 프레임이
 *    무너집니다 (CLAUDE.md 4-5). CSS transition 만 씁니다.
 */
function OperationsSeatMapImpl({ areas, selectedTicketId, onSelectSeat }: Props) {
  /* 좌표가 없는 좌석은 그릴 수 없습니다(스탠딩의 가상 좌석). 정원 카드로 따로 보여줍니다 */
  const placed: PlacedSeat[] = areas.flatMap((area) =>
    area.seats
      .filter((seat) => seat.seatX !== null && seat.seatY !== null)
      .map((seat) => ({ x: seat.seatX as number, y: seat.seatY as number, seat, area })),
  );

  const seatSize = seatSizeOf(placed);
  const view = placed.length === 0 ? FULL_VENUE : viewBoxOf(placed, seatSize);

  /* 무대 표시는 뷰박스의 가로 중앙. SVG 퍼센트는 minX 를 더하지 않으므로 사용자 좌표로 계산합니다 */
  const stageCenterX = view.minX + view.width / 2;
  const stageLineWidth = view.width * STAGE_LINE_RATIO;

  return (
    <div className="flex min-h-0 w-full">
      <svg
        viewBox={`${view.minX} ${view.minY} ${view.width} ${view.height}`}
        className="no-select min-h-0 w-full flex-1"
        role="group"
        aria-label="운영 좌석 배치도"
      >
        <text
          x={stageCenterX}
          y={view.minY + seatSize * 1.3}
          textAnchor="middle"
          style={{ fontSize: seatSize * 0.9 }}
          className="fill-ink-subtle font-bold tracking-[0.35em]"
        >
          STAGE
        </text>
        <rect
          x={stageCenterX - stageLineWidth / 2}
          y={view.minY + seatSize * 1.9}
          width={stageLineWidth}
          height={Math.max(seatSize * 0.1, 1.5)}
          rx="1"
          className="fill-line-strong"
        />

        {placed.map(({ x, y, seat, area }) => {
          const openable = hasTicket(seat);
          const selected = openable && seat.ticketId === selectedTicketId;

          return (
            <rect
              key={`${area.areaId}-${seat.seatId}`}
              x={x}
              y={y}
              width={seatSize}
              height={seatSize}
              rx={seatSize * 0.25}
              role="button"
              tabIndex={openable ? 0 : -1}
              aria-label={`${area.areaCode}구역 ${seat.rowLabel ?? ''}열 ${seat.seatNumber ?? ''}번 ${
                OPERATIONS_SEAT_LABEL[seat.state]
              }`}
              aria-pressed={selected}
              aria-disabled={!openable}
              onClick={() => openable && onSelectSeat(seat, area)}
              onKeyDown={(event) => {
                if (!openable) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectSeat(seat, area);
                }
              }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              className={cn(
                'transition-[fill,opacity,transform] duration-150',
                OPERATIONS_SEAT_FILL[seat.state],
                /* 고른 자리는 **크기와 테두리**로 표시합니다. 색을 바꾸면 그 자리의
                   예매·입장 상태를 읽을 수 없게 됩니다 — 색은 상태의 것입니다. */
                selected && 'stroke-ink scale-125',
                openable ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                seat.state === 'BLOCKED' && 'opacity-40',
              )}
              strokeWidth={selected ? Math.max(seatSize * 0.12, 0.8) : 0}
            />
          );
        })}
      </svg>
    </div>
  );
}

/** 15초마다 폴링이 돌기 때문에, 좌석 배열이 그대로면 리렌더를 건너뜁니다 */
export const OperationsSeatMap = memo(OperationsSeatMapImpl);
