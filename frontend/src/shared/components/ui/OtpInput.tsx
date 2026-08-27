import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/shared/lib';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  /** 인증 실패 시 흔들림 + 붉은 테두리 */
  invalid?: boolean;
  /** 마지막 칸까지 입력되면 자동 제출 */
  onComplete?: (value: string) => void;
}

/**
 * 인증번호 입력 칸.
 *
 * 칸을 여러 개 만들고 각각 input 을 두면 붙여넣기/삭제/IME 처리가 지옥이 됩니다.
 * 여기서는 **투명한 input 하나**를 위에 덮고, 아래에 칸을 그리기만 합니다.
 * 모바일 숫자 키패드(inputMode="numeric")와 SMS 자동완성도 그대로 동작합니다.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  invalid,
  onComplete,
}: OtpInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (next: string) => {
    const digits = next.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    commit(e.clipboardData.getData('text'));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 커서 위치와 무관하게 항상 마지막 글자가 지워지도록
    if (e.key === 'Backspace' && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className={cn('relative', invalid && 'animate-shake')}
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => commit(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        aria-label="인증번호"
        className="absolute inset-0 z-10 h-full w-full cursor-default opacity-0"
      />

      <div className="flex justify-center gap-2">
        {Array.from({ length }).map((_, i) => {
          const char = value[i];
          const active = i === value.length;

          return (
            <span
              key={i}
              aria-hidden
              className={cn(
                'surface-2 flex h-15 w-11 items-center justify-center rounded-xl border text-xl font-bold tabular-nums',
                'transition-all duration-200',
                char && 'border-brand-500 text-brand-800',
                active && !disabled && 'border-brand-400',
                invalid && 'border-danger text-danger',
                !char && !active && 'border-line',
              )}
            >
              {char ?? ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}
