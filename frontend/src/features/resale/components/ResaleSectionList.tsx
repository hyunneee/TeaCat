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

export function ResaleSectionList({ sections, selectedId, onSelect }: Props) {
  return (
    <Stagger as="ul" className="space-y-2">
      {sections.map((section) => {
        const selected = section.sectionId === selectedId;

        return (
          <Stagger.Item as="li" key={section.sectionId}>
            <button
              type="button"
              onClick={() => onSelect(section)}
              aria-pressed={selected}
              className={cn(
                'surface flex w-full items-center gap-3 rounded-xl border p-4 text-left',
                'transition-all duration-200',
                selected
                  ? 'border-brand-800 bg-brand-50'
                  : 'border-line hover:border-brand-700 active:scale-[0.99]',
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
                <p className="text-brand-700 mt-0.5 text-sm font-semibold">
                  {formatPrice(section.price)}
                </p>
              </div>

              <div className="text-subtle flex shrink-0 items-center gap-1 text-xs">
                <Users size={13} />
                {section.waitingCount}명 대기
              </div>
            </button>
          </Stagger.Item>
        );
      })}
    </Stagger>
  );
}
