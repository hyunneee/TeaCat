import { motion } from 'motion/react';
import { Check, Users } from 'lucide-react';
import { Stagger } from '@/shared/components/common';
import { cn, formatPrice, SPRING } from '@/shared/lib';
import type { ResaleSection } from '../model/resale.types';

interface Props {
  sections: ResaleSection[];
  selectedId: string | null;
  onSelect: (section: ResaleSection) => void;
}

/**
 * 취소표 대기를 걸 구역 목록.
 *
 * 매진되지 않은 구역은 고를 수 없습니다 — 자리가 남아 있으면 대기가 아니라 예매를 해야 합니다.
 * 목록에서 빼지 않고 흐리게 남겨두는 이유는 "이 구역은 아직 살 수 있다" 는 정보 자체가 유용하기 때문입니다.
 */
export function ResaleSectionList({ sections, selectedId, onSelect }: Props) {
  return (
    <Stagger as="ul" className="space-y-2">
      {sections.map((section) => {
        const selected = section.sectionId === selectedId;
        const selectable = section.soldOut;

        return (
          <Stagger.Item as="li" key={section.sectionId}>
            <button
              type="button"
              disabled={!selectable}
              onClick={() => onSelect(section)}
              aria-pressed={selected}
              className={cn(
                'surface shadow-card flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left',
                'transition-all duration-200',
                selected
                  ? 'border-brand-900'
                  : 'border-transparent hover:border-line active:scale-[0.99]',
                !selectable && 'opacity-50 hover:border-transparent active:scale-100',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  selected ? 'border-brand-900 bg-brand-900' : 'border-line-strong',
                )}
              >
                {selected && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING}>
                    <Check size={12} strokeWidth={3.5} className="text-white" />
                  </motion.span>
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-bold">{section.name}</p>
                <p className="text-ink mt-0.5 text-sm font-semibold">
                  {formatPrice(section.price)}
                </p>
              </div>

              {selectable ? (
                <div className="text-subtle flex shrink-0 items-center gap-1 text-xs">
                  <Users size={13} />
                  {section.waitingCount}명 대기
                </div>
              ) : (
                <span className="text-subtle shrink-0 text-xs">예매 가능 · 대기 불필요</span>
              )}
            </button>
          </Stagger.Item>
        );
      })}
    </Stagger>
  );
}
