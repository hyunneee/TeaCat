import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { cn, formatPrice, SPRING } from '@/shared/lib';
import { isSectionSoldOut, sectionRemainRatio } from '../model/seat.model';
import type { Section } from '../model/booking.types';

interface Props {
  sections: Section[];
  selectedId: string | null;
  onSelect: (section: Section) => void;
}

/** 잔여율에 따른 표시 — 색만 보고도 급한 정도가 읽히게 */
function remainInfo(section: Section) {
  if (isSectionSoldOut(section)) return { tone: 'neutral' as const, label: '매진', bar: 'bg-line-strong' };
  const ratio = sectionRemainRatio(section);
  if (ratio < 0.1) return { tone: 'danger' as const, label: '마감임박', bar: 'bg-danger' };
  if (ratio < 0.35) return { tone: 'warning' as const, label: '여유 적음', bar: 'bg-warning' };
  return { tone: 'success' as const, label: '여유', bar: 'bg-success' };
}

/** 순수 View — 구역 카드 목록 */
export function SectionGrid({ sections, selectedId, onSelect }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-2.5">
      {sections.map((section) => {
        const soldOut = isSectionSoldOut(section);
        const info = remainInfo(section);
        const selected = section.id === selectedId;
        const ratio = sectionRemainRatio(section);

        return (
          <li key={section.id}>
            <button
              type="button"
              disabled={soldOut}
              onClick={() => onSelect(section)}
              aria-pressed={selected}
              className={cn(
                'surface relative w-full overflow-hidden rounded-xl border p-3.5 text-left',
                'transition-all duration-200',
                'disabled:cursor-not-allowed disabled:opacity-40',
                selected
                  ? 'border-brand-800 bg-brand-50'
                  : 'border-line enabled:hover:border-brand-700 enabled:active:scale-[0.98]',
              )}
            >
              {/* 선택 표시 — 어느 구역을 골랐는지 한눈에 */}
              {selected && (
                <motion.span
                  layoutId="section-check"
                  transition={SPRING}
                  className="bg-brand-900 absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full text-white"
                >
                  <Check size={13} strokeWidth={3} />
                </motion.span>
              )}

              <div className="flex items-center justify-between gap-1 pr-6">
                <span className="truncate font-bold">{section.name}</span>
              </div>

              <p className="text-brand-700 mt-1 text-sm font-bold">{formatPrice(section.price)}</p>

              <div className="mt-2 flex items-center justify-between gap-1">
                <span className="text-subtle text-xs">
                  {section.availableSeats}/{section.totalSeats}석
                </span>
                <Badge tone={info.tone}>{info.label}</Badge>
              </div>

              {/* 잔여율 게이지 */}
              <div className="surface-sunken mt-2 h-1.5 overflow-hidden rounded-full">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: ratio }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{ transformOrigin: 'left' }}
                  className={cn('h-full w-full rounded-full', info.bar)}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
