import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/shared/lib';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  /** 입력 아래 회색 안내문 */
  hint?: string;
  /** 값이 있으면 붉은 테두리 + 에러 메시지. hint 를 덮어씁니다. */
  error?: string | null;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}

/**
 * 라벨·힌트·에러·아이콘을 한 세트로 묶은 입력.
 *
 * 화면마다 `<input className="h-12 rounded-xl border px-4">` 를 반복하면
 * 디자인이 바뀔 때 전부 찾아 고쳐야 합니다. 항상 이걸 쓰세요.
 */
export function Input({
  label,
  hint,
  error,
  leftIcon,
  rightSlot,
  className,
  id,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error || hint ? `${inputId}-desc` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-ink-muted text-sm font-medium">
          {label}
        </label>
      )}

      <div
        className={cn(
          'surface-2 flex h-12 items-center gap-2.5 rounded-xl border px-3.5',
          'transition-[border-color,box-shadow] duration-200',
          error
            ? 'border-danger focus-within:border-danger'
            : 'border-line-strong focus-within:border-brand-400',
        )}
      >
        {leftIcon && <span className="text-subtle shrink-0">{leftIcon}</span>}

        <input
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn('w-full min-w-0 bg-transparent outline-none disabled:opacity-50', className)}
          {...rest}
        />

        {rightSlot}
      </div>

      {(error || hint) && (
        <p
          id={describedBy}
          className={cn(
            'flex items-center gap-1 text-xs',
            error ? 'text-danger animate-fade-in' : 'text-subtle',
          )}
        >
          {error && <AlertCircle size={13} className="shrink-0" />}
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
