import { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import { cn, DURATION, EASE } from '@/shared/lib';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 스크린리더용 이름 — 화면에는 안 보입니다 */
  label: string;
  /** 목록을 오른쪽 끝에 맞출지 (오른쪽에 붙은 정렬 버튼) */
  align?: 'left' | 'right';
  className?: string;
}

/**
 * 값 하나를 고르는 드롭다운. (정렬, 필터)
 *
 * ── 왜 `<select>` 를 쓰지 않나 ─────────────────────────────
 * 네이티브 셀렉트가 여는 목록은 **OS 가 그립니다.** 곡률·글꼴·간격이 앱과 따로 놀고,
 * 안드로이드에서는 화면 가운데 회색 다이얼로그가 뜹니다.
 * 옵션이 서넛뿐인 정렬 같은 곳에서는 직접 그리는 편이 화면과 이어집니다.
 *
 * 접근성은 네이티브만큼 나오지 않으므로 **긴 목록·폼 입력에는 쓰지 마세요.**
 * 그런 곳은 네이티브 `<select>` 가 맞습니다.
 */
export function Select<T extends string>({
  options,
  value,
  onChange,
  label,
  align = 'right',
  className,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const current = options.find((option) => option.value === value);

  /* 바깥을 누르거나 ESC 를 누르면 닫습니다.
     하나라도 빠지면 목록이 열린 채로 남아 다른 걸 못 누릅니다. */
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'text-ink-muted hover:text-ink flex items-center gap-1 rounded-lg py-1 text-sm font-medium',
          'transition-colors',
          open && 'text-ink',
        )}
      >
        {current?.label}
        <ChevronDown
          size={15}
          className={cn('transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <motion.ul
          id={listId}
          role="listbox"
          aria-label={label}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.quick, ease: EASE.out }}
          className={cn(
            'surface absolute top-full z-30 mt-1.5 min-w-36 overflow-hidden rounded-xl py-1',
            /* 떠 있는 면이라 여기서는 테두리 대신 **그림자**로 층을 만듭니다 */
            'shadow-[0_6px_24px_oklch(0_0_0/0.14)]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'hover:bg-surface-2 flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm transition-colors',
                    selected ? 'text-ink font-bold' : 'text-ink-muted',
                  )}
                >
                  <span className="flex-1 whitespace-nowrap">{option.label}</span>
                  {selected && <Check size={15} className="shrink-0" />}
                </button>
              </li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
