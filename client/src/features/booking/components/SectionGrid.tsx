import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { cn, SPRING } from '@/shared/lib';
import {
  SECTION_AVAILABILITY_LABEL,
  isSectionBookable,
  priceLabel,
  sectionAvailability,
  sectionBlockedReason,
  sectionRemainRatio,
} from '../model/seat.model';
import type { Section } from '../model/booking.types';

interface Props {
  sections: Section[];
  selectedId: string | null;
  onSelect: (section: Section) => void;
}

/**
 * 배지 문구와 잔여 막대.
 *
 * 🔴 팔 수 없는 구역은 잔여율이 아니라 **왜 못 사는지**를 보여줍니다.
 *    "매진" 과 "준비 중"(좌석 미생성)은 남은 자리가 0 인 건 같지만 뜻이 정반대입니다.
 */
function remainInfo(section: Section) {
  const availability = sectionAvailability(section);

  if (availability !== 'ON_SALE') {
    return {
      tone: availability === 'SOLD_OUT' ? ('neutral' as const) : ('warning' as const),
      label: SECTION_AVAILABILITY_LABEL[availability],
      bar: 'bg-line-strong',
    };
  }

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
        const bookable = isSectionBookable(section);
        const blockedReason = sectionBlockedReason(section);
        const info = remainInfo(section);
        const selected = section.id === selectedId;
        const ratio = sectionRemainRatio(section);

        return (
          <li key={section.id}>
            <button
              type="button"
              /* 🔴 잔여 수가 아니라 **팔 수 있는지**로 막습니다. 가격 미정 구역을 열어두면
                 좌석 화면까지 갔다가 아무것도 못 고르고 되돌아 나오게 됩니다 */
              disabled={!bookable}
              aria-describedby={blockedReason ? `${section.id}-reason` : undefined}
              onClick={() => onSelect(section)}
              aria-pressed={selected}
              className={cn(
                'surface shadow-card relative w-full overflow-hidden rounded-2xl border-2 p-3.5 text-left',
                'transition-all duration-200',
                'disabled:cursor-not-allowed disabled:opacity-40',
                /* 고른 구역은 **테두리 색**으로 표시합니다. 두께를 항상 2px 로 두면
                   고를 때마다 격자가 흔들리지 않습니다. */
                selected
                  ? 'border-brand-900'
                  : 'enabled:hover:border-line border-transparent enabled:active:scale-[0.98]',
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

              <p className="text-ink mt-1 text-sm font-bold">{priceLabel(section.price)}</p>

              <div className="mt-2 flex items-center justify-between gap-1">
                <span className="text-subtle text-xs">
                  {section.availableSeats}/{section.totalSeats}석
                </span>
                <Badge tone={info.tone}>{info.label}</Badge>
              </div>

              {/* 잔여율 게이지 */}
              <div className="surface-2 mt-2 h-1.5 overflow-hidden rounded-full">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: ratio }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{ transformOrigin: 'left' }}
                  className={cn('h-full w-full rounded-full', info.bar)}
                />
              </div>

              {/* 못 고르는 이유를 카드 안에 적습니다. 배지만 있으면 "매진" 과
                  "준비 중" 이 왜 다른지 알 수 없습니다 */}
              {blockedReason && (
                <p id={`${section.id}-reason`} className="text-subtle mt-1.5 text-xs">
                  {blockedReason}
                </p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
