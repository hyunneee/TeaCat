import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/shared/lib';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  /** 값이 있으면 붉은 테두리 + 에러 메시지. hint 를 덮어씁니다. */
  error?: string | null;
  /** 라벨 옆에 필수/선택 표시 */
  showRequirement?: boolean;
  /** maxLength 와 함께 쓰면 "12 / 200" 을 보여줍니다 */
  showCount?: boolean;
  rightSlot?: ReactNode;
}

/**
 * 여러 줄 입력. `Input` 과 같은 껍데기(라벨·힌트·에러)를 공유합니다.
 *
 * Input 을 복사해 만들지 마세요 — 디자인이 바뀔 때 두 곳을 고치게 됩니다.
 */
export function Textarea({
  label,
  hint,
  error,
  showRequirement = false,
  showCount = false,
  required,
  className,
  id,
  maxLength,
  value,
  rows = 3,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy = error || hint ? `${fieldId}-desc` : undefined;
  const length = typeof value === 'string' ? value.length : 0;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={fieldId}
          className="text-ink-muted flex items-center gap-1.5 text-sm font-medium"
        >
          {label}
          {showRequirement &&
            (required ? (
              <span aria-hidden className="text-danger leading-none">
                *
              </span>
            ) : (
              <span className="border-line text-subtle rounded border px-1 py-px text-[0.625rem] font-semibold">
                선택
              </span>
            ))}
        </label>
      )}

      <div
        className={cn(
          'surface-2 rounded-xl border px-3.5 py-2.5',
          'transition-[border-color,box-shadow] duration-200',
          error
            ? 'border-danger focus-within:border-danger'
            : 'border-line-strong focus-within:border-brand-400',
        )}
      >
        <textarea
          id={fieldId}
          rows={rows}
          value={value}
          required={required}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(
            'w-full min-w-0 resize-none bg-transparent outline-none disabled:opacity-50',
            className,
          )}
          {...rest}
        />
      </div>

      <div className="flex items-start gap-2">
        {(error || hint) && (
          <p
            id={describedBy}
            className={cn(
              'flex flex-1 items-center gap-1 text-xs',
              error ? 'text-danger animate-fade-in' : 'text-subtle',
            )}
          >
            {error && <AlertCircle size={13} className="shrink-0" />}
            {error ?? hint}
          </p>
        )}
        {showCount && maxLength && (
          <span className="text-subtle ml-auto shrink-0 text-xs tabular-nums">
            {length} / {maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
