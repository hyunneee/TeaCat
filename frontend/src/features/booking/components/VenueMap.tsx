import { cn, formatPrice } from '@/shared/lib';
import { isSectionSoldOut, sectionRemainRatio } from '../model/seat.model';
import type { Section } from '../model/booking.types';

interface Props {
  sections: Section[];
  selectedId: string | null;
  onSelect: (section: Section) => void;
  className?: string;
}

/**
 * 공연장 도면 — 구역이 무대를 기준으로 어디에 있는지 보여줍니다.
 *
 * 목록만 있으면 "R석 A" 가 왼쪽인지 오른쪽인지 알 수 없어서,
 * 사용자는 결국 가격만 보고 고르게 됩니다. 위치를 보여주면
 * "무대에서 가깝지만 옆" 같은 판단을 할 수 있습니다.
 *
 * 좌표는 **서버가 준 `bounds`** 를 그대로 씁니다. 좌석 간격 같은 걸
 * 프론트에서 되짚으면 공연장이 늘어날 때마다 어긋납니다.
 *
 * 무채색이라 위치·크기·명도로만 구분합니다. 잔여가 적을수록 옅어집니다.
 */

/** 도면 위아래 여백 (무대와 테두리 자리) */
const PAD = 70;

export function VenueMap({ sections, selectedId, onSelect, className }: Props) {
  if (sections.length === 0) return null;

  const left = Math.min(...sections.map((s) => s.bounds.x));
  const right = Math.max(...sections.map((s) => s.bounds.x + s.bounds.width));
  const top = Math.min(...sections.map((s) => s.bounds.y));
  const bottom = Math.max(...sections.map((s) => s.bounds.y + s.bounds.height));

  const viewBox = `${left - PAD} ${top - PAD} ${right - left + PAD * 2} ${bottom - top + PAD * 2}`;
  const stageWidth = (right - left) * 0.46;

  return (
    <div className={cn('surface-2 border-line overflow-hidden rounded-xl border p-2', className)}>
      <svg viewBox={viewBox} className="h-auto w-full" role="group" aria-label="공연장 구역 도면">
        {/* 무대 — 모든 방향 감각의 기준점입니다 */}
        <rect
          x={left + (right - left - stageWidth) / 2}
          y={top - PAD + 8}
          width={stageWidth}
          height={30}
          rx={6}
          className="fill-brand-900"
        />
        <text
          x={left + (right - left) / 2}
          y={top - PAD + 28}
          textAnchor="middle"
          className="fill-white text-[15px] font-bold"
        >
          STAGE
        </text>

        {sections.map((section) => {
          const soldOut = isSectionSoldOut(section);
          const selected = section.id === selectedId;
          const { x, y, width, height } = section.bounds;
          // 잔여가 적을수록 옅게 — 색을 쓰지 않고 급한 정도를 보여줍니다.
          const remain = sectionRemainRatio(section);

          return (
            <g
              key={section.id}
              role="button"
              tabIndex={soldOut ? -1 : 0}
              aria-pressed={selected}
              aria-label={`${section.name} ${formatPrice(section.price)} ${soldOut ? '매진' : `잔여 ${section.availableSeats}석`}`}
              onClick={() => !soldOut && onSelect(section)}
              onKeyDown={(event) => {
                if (soldOut) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(section);
                }
              }}
              className={cn('transition-opacity', soldOut ? 'opacity-35' : 'cursor-pointer')}
            >
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx={10}
                className={cn(selected ? 'fill-brand-900' : 'fill-brand-200 stroke-brand-400')}
                strokeWidth={selected ? 0 : 2}
                opacity={selected || soldOut ? 1 : 0.35 + remain * 0.65}
              />
              <text
                x={x + width / 2}
                y={y + height / 2 + 2}
                textAnchor="middle"
                className={cn('text-[17px] font-bold', selected ? 'fill-white' : 'fill-brand-900')}
              >
                {section.name}
              </text>
              <text
                x={x + width / 2}
                y={y + height / 2 + 22}
                textAnchor="middle"
                className={cn('text-[14px]', selected ? 'fill-white/80' : 'fill-brand-700')}
              >
                {soldOut ? '매진' : `${section.availableSeats}석`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
