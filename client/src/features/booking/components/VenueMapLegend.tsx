import type { ConcertLayout } from '@/features/concert';

/**
 * 도면 범례 — 도면에 실제로 그려진 것만 설명합니다.
 *
 * 기둥이 없는 공연장에서 "기둥" 범례를 보여주면 없는 걸 찾게 됩니다.
 * 그래서 배치도에 그 요소가 있을 때만 줄을 만듭니다.
 */
export interface VenueMapLegendProps {
  layout?: ConcertLayout;
}

export function VenueMapLegend({ layout }: VenueMapLegendProps) {
  if (!layout) return null;

  const types = [...layout.baseElements, ...layout.elements]
    .map((element) => element.type.toUpperCase())
    .join(' ');

  const items = [
    types.includes('PILLAR') || types.includes('기둥')
      ? { key: 'pillar', label: '기둥 — 시야가 가릴 수 있어요', swatch: 'venue-hatch' as const }
      : null,
    types.includes('GATE') || types.includes('출입') || types.includes('DOOR')
      ? { key: 'gate', label: '출입구', swatch: 'gate' as const }
      : null,
  ].filter((item) => item !== null);

  if (items.length === 0) return null;

  return (
    <ul className="text-subtle flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          {item.swatch === 'venue-hatch' ? (
            /* 도면의 기둥과 **같은 빗금**이어야 합니다. 범례가 실물과 다르면 없느니만 못합니다 */
            <svg width="14" height="14" aria-hidden className="shrink-0">
              <pattern
                id="legend-hatch"
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" className="fill-brand-400" />
                <line x1="0" y1="0" x2="0" y2="6" className="stroke-brand-600" strokeWidth="3" />
              </pattern>
              <rect width="14" height="14" rx="3" fill="url(#legend-hatch)" />
            </svg>
          ) : (
            <span aria-hidden className="bg-brand-300 size-3.5 shrink-0 rounded-[3px]" />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}
