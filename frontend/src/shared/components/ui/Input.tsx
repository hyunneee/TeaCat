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
  /**
   * 라벨 옆에 필수/선택을 표시할지.
   * 폼 전체에 켜두면 사용자가 "뭘 꼭 채워야 하나"를 스캔만으로 압니다.
   */
  showRequirement?: boolean;
  /**
   * 배경 톤. 변형이 필요하면 아래 TONE 테이블에 한 줄만 추가하세요.
   *   default  — 연회색 (폼 안에서 카드와 구분)
   *   contrast — 흰 배경 + 진한 테두리 (검색 바처럼 목록 위에서 도드라져야 할 때)
   */
  tone?: InputTone;
}

export type InputTone = 'default' | 'contrast';

const TONE: Record<InputTone, string> = {
  default: 'surface-2 border-line-strong',
  contrast: 'surface border-line-strong shadow-card',
};

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
  showRequirement = false,
  tone = 'default',
  required,
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
        <label htmlFor={inputId} className="text-ink-muted flex items-center gap-1.5 text-sm font-medium">
          {label}
          {showRequirement &&
            (required ? (
              // 필수는 붉은 별표 하나로 충분합니다. 폼마다 문구를 다르게 쓰면 어수선해집니다.
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
          'flex h-12 items-center gap-2.5 rounded-xl border px-3.5',
          'transition-[border-color,box-shadow] duration-200',
          TONE[tone],
          error
            ? 'border-danger focus-within:border-danger'
            : 'focus-within:border-brand-900',
        )}
      >
        {leftIcon && <span className="text-subtle shrink-0">{leftIcon}</span>}

        <input
          id={inputId}
          required={required}
          aria-required={required || undefined}
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
