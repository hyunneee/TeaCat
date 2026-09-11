import { cn } from '@/shared/lib';
import type { ConcertLayout, LayoutElement } from '@/features/concert';
import {
  SECTION_AVAILABILITY_LABEL,
  isSectionBookable,
  priceLabel,
  sectionAvailability,
  sectionRemainRatio,
} from '../model/seat.model';
import type { Section } from '../model/booking.types';

interface Props {
  sections: Section[];
  selectedId: string | null;
  onSelect: (section: Section) => void;
  /**
   * 공연 배치도. 있으면 **배치도 좌표계**로 그리고 기둥·출입구까지 함께 보여줍니다.
   * 없으면(아직 로딩 중이거나 실패) 구역만으로 좌표계를 잡습니다 — 도면은 여전히 보입니다.
   */
  layout?: ConcertLayout;
  className?: string;
}

/**
 * 공연장 도면 — 구역이 무대를 기준으로 어디에 있는지 보여줍니다.
 *
 * 목록만 있으면 "R석 A" 가 왼쪽인지 오른쪽인지 알 수 없어서, 사용자는 결국 가격만 보고
 * 고르게 됩니다. 위치를 보여주면 "무대에서 가깝지만 옆" 같은 판단을 할 수 있습니다.
 *
 * 좌표는 **서버가 준 값**을 그대로 씁니다 (구역 `bounds`, 배치도 `elements`).
 * 좌석 간격 같은 걸 프론트에서 되짚으면 공연장이 늘어날 때마다 어긋납니다.
 *
 * ── 왜 배치도 좌표계를 쓰는가 ──────────────────────────────────
 * 예전에는 구역들의 최소·최대 좌표로 viewBox 를 만들었습니다. 그러면 **기둥이 제자리에
 * 찍히지 않습니다** — 기둥 좌표는 배치도 전체 기준인데 구역만으로 자른 좌표계에 얹으면
 * 어긋나기 때문입니다. 배치도가 오면 그 좌표계(width × height)를 그대로 씁니다.
 */

/** 도면 위쪽 무대 자리 (배치도에 STAGE 요소가 없을 때만 씁니다) */
const STAGE_BAND = 90;
/** 도면 가장자리 여백 — 구역 테두리가 잘리지 않게 */
const PAD = 24;

/** 고정 요소의 겉모습. 모르는 타입은 기본값으로 그립니다 */
function elementStyle(type: string) {
  const upper = type.toUpperCase();
  if (upper.includes('STAGE') || upper.includes('무대')) {
    return { fill: 'fill-brand-800', text: 'fill-white', label: '무대' };
  }
  if (upper.includes('PILLAR') || upper.includes('기둥')) {
    /* 기둥은 **시야를 가리는** 것이라 눈에 띄어야 합니다. 빗금으로 "지나갈 수 없는 자리" 임을 보입니다 */
    return { fill: 'fill-brand-500', text: 'fill-white', label: '기둥' };
  }
  if (upper.includes('GATE') || upper.includes('출입') || upper.includes('DOOR')) {
    return { fill: 'fill-brand-300', text: 'fill-brand-900', label: '출입구' };
  }
  return { fill: 'fill-brand-200', text: 'fill-brand-800', label: null };
}

export function VenueMap({ sections, selectedId, onSelect, layout, className }: Props) {
  if (sections.length === 0) return null;

  /* 배치도가 있으면 그 좌표계, 없으면 구역들을 감싸는 사각형.
     둘 중 무엇이든 구역·요소 좌표를 그대로 얹을 수 있어야 합니다 */
  const left = layout ? 0 : Math.min(...sections.map((s) => s.bounds.x));
  const top = layout ? 0 : Math.min(...sections.map((s) => s.bounds.y));
  const right = layout ? layout.width : Math.max(...sections.map((s) => s.bounds.x + s.bounds.width));
  const bottom = layout
    ? layout.height
    : Math.max(...sections.map((s) => s.bounds.y + s.bounds.height));

  const elements = [...(layout?.baseElements ?? []), ...(layout?.elements ?? [])];
  const hasStage = elements.some((el) => elementStyle(el.type).label === '무대');

  /* 배치도에 무대가 없으면 위쪽에 기준선을 하나 그립니다 —
     무대가 어디인지 모르면 "앞자리" 라는 말 자체가 성립하지 않습니다 */
  const stageBand = hasStage ? 0 : STAGE_BAND;
  const viewBox = `${left - PAD} ${top - stageBand - PAD} ${right - left + PAD * 2} ${
    bottom - top + stageBand + PAD * 2
  }`;
  const stageWidth = (right - left) * 0.44;

  /* 글자 크기는 도면 크기에 비례해야 합니다. 고정 px 로 두면 큰 공연장에서는
     개미만 하고 작은 공연장에서는 구역을 뚫고 나갑니다 */
  const unit = Math.max(right - left, bottom - top) / 100;

  return (
    <div className={cn('surface-2 overflow-hidden rounded-2xl p-2', className)}>
      <svg viewBox={viewBox} className="h-auto w-full" role="group" aria-label="공연장 구역 도면">
        <defs>
          {/* 기둥 빗금 — 색을 늘리지 않고 "여기는 자리가 아니다" 를 보이게 합니다 */}
          <pattern id="venue-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="fill-brand-400" />
            <line x1="0" y1="0" x2="0" y2="6" className="stroke-brand-600" strokeWidth="3" />
          </pattern>
        </defs>

        {!hasStage && (
          <>
            <rect
              x={left + (right - left - stageWidth) / 2}
              y={top - stageBand}
              width={stageWidth}
              height={stageBand * 0.5}
              rx={unit}
              className="fill-brand-800"
            />
            <text
              x={left + (right - left) / 2}
              y={top - stageBand + stageBand * 0.32}
              textAnchor="middle"
              className="fill-white font-bold"
              style={{ fontSize: unit * 3.4 }}
            >
              STAGE
            </text>
          </>
        )}

        {/* 고정 요소는 구역보다 **먼저** 그립니다 — 구역이 위에 와야 누를 수 있습니다 */}
        {elements.map((element, index) => (
          <VenueElement key={`${element.type}-${index}`} element={element} unit={unit} />
        ))}

        {sections.map((section) => {
          const availability = sectionAvailability(section);
          const bookable = isSectionBookable(section);
          const selected = section.id === selectedId;
          const { x, y, width, height } = section.bounds;
          // 잔여가 적을수록 옅게 — 색을 쓰지 않고 급한 정도를 보여줍니다
          const remain = sectionRemainRatio(section);

          return (
            <g
              key={section.id}
              role="button"
              tabIndex={bookable ? 0 : -1}
              aria-disabled={!bookable}
              aria-pressed={selected}
              aria-label={`${section.name} ${priceLabel(section.price)} ${
                bookable ? `잔여 ${section.availableSeats}석` : SECTION_AVAILABILITY_LABEL[availability]
              }`}
              onClick={() => bookable && onSelect(section)}
              onKeyDown={(event) => {
                if (!bookable) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(section);
                }
              }}
              className={cn('transition-opacity', bookable ? 'cursor-pointer' : 'opacity-40')}
            >
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx={unit * 1.6}
                className={cn(
                  selected ? 'fill-brand-900 stroke-brand-900' : 'fill-brand-100 stroke-brand-500',
                )}
                /* 🔴 테두리를 굵게 둡니다. 얇으면 큰 공연장에서 축소됐을 때 구역 경계가
                   사라져 도면이 회색 덩어리로 보입니다 */
                strokeWidth={selected ? unit * 0.9 : unit * 0.55}
                opacity={selected || !bookable ? 1 : 0.45 + remain * 0.55}
              />
              <text
                x={x + width / 2}
                y={y + height / 2 - unit * 0.2}
                textAnchor="middle"
                className={cn('font-bold', selected ? 'fill-white' : 'fill-brand-900')}
                style={{ fontSize: unit * 4.2 }}
              >
                {section.name}
              </text>
              <text
                x={x + width / 2}
                y={y + height / 2 + unit * 3.4}
                textAnchor="middle"
                className={selected ? 'fill-white/85' : 'fill-brand-700'}
                style={{ fontSize: unit * 2.9 }}
              >
                {bookable
                  ? `${section.availableSeats}석`
                  : SECTION_AVAILABILITY_LABEL[availability]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** 기둥·출입구 등 고정 요소 하나. 누를 수 없으므로 마우스 이벤트를 통과시킵니다 */
function VenueElement({ element, unit }: { element: LayoutElement; unit: number }) {
  const style = elementStyle(element.type);
  const isPillar = style.label === '기둥';
  const text = element.label?.trim() || style.label;

  /* 좁은 요소에 글자를 넣으면 밖으로 삐져나와 도면을 어지럽힙니다.
     들어갈 자리가 있을 때만 적습니다 */
  const fontSize = unit * 2.4;
  const fits = !!text && element.width > fontSize * text.length * 0.7 && element.height > fontSize * 1.4;

  return (
    <g className="pointer-events-none" aria-hidden>
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rx={unit * 0.6}
        className={isPillar ? undefined : style.fill}
        fill={isPillar ? 'url(#venue-hatch)' : undefined}
      />
      {fits && (
        <text
          x={element.x + element.width / 2}
          y={element.y + element.height / 2 + fontSize * 0.35}
          textAnchor="middle"
          className={cn('font-semibold', style.text)}
          style={{ fontSize }}
        >
          {text}
        </text>
      )}
    </g>
  );
}
