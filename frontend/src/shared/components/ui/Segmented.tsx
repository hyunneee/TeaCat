import { useId } from 'react';
import { motion } from 'motion/react';
import { cn, SPRING } from '@/shared/lib';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** 라벨 옆 개수 표시 */
  count?: number;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * 탭/필터. 제네릭이라 값 타입이 문자열 유니온으로 좁혀집니다.
 *
 *   <Segmented options={TABS} value={tab} onChange={setTab} />
 *
 * onChange 인자가 'ALL' | 'VALID' | 'USED' 로 추론되므로 오타가 컴파일 에러가 됩니다.
 * 선택 표시는 layoutId 로 미끄러지듯 이동합니다 — 어디서 어디로 옮겼는지 눈이 따라갑니다.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  // 한 화면에 Segmented 가 둘 이상이어도 인디케이터가 섞이지 않도록 고유 id
  const layoutId = useId();

  return (
    <div
      role="tablist"
      className={cn('surface-sunken border-line flex gap-1 rounded-xl border p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-150',
              active ? 'text-white' : 'text-ink-subtle hover:text-ink-muted',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={SPRING}
                className="bg-brand-900 absolute inset-0 rounded-lg"
              />
            )}
            <span className="relative">
              {option.label}
              {option.count !== undefined && (
                <span className="ml-1 text-xs opacity-70">{option.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
