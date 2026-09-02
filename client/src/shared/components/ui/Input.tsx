import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, X } from 'lucide-react';
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
   * 지우기(X) 버튼. 주면 **값이 있을 때만** 오른쪽에 나타납니다.
   *
   * 검색창마다 X 버튼을 직접 그리면 크기·간격·라벨이 화면마다 조금씩 달라집니다.
   * 여기서 한 번만 그립니다. (rightSlot 과 함께 쓰면 X 가 왼쪽입니다)
   */
  onClear?: () => void;
  /**
   * 라벨 옆에 필수/선택을 표시할지.
   * 폼 전체에 켜두면 사용자가 "뭘 꼭 채워야 하나"를 스캔만으로 압니다.
   */
  showRequirement?: boolean;
  /**
   * 배경 톤. 변형이 필요하면 아래 TONE 테이블에 한 줄만 추가하세요.
   *   default  — 연회색 면 (폼 입력)
   *   contrast — 흰 면 + 그림자 (검색 바처럼 목록 위에서 도드라져야 할 때)
   */
  tone?: InputTone;
}

export type InputTone = 'default' | 'contrast';

/**
 * **테두리를 두르지 않습니다.** 입력칸이 여러 개 쌓이는 폼에서 칸마다 선이 있으면
 * 화면이 표처럼 보이고, 정작 눌러야 할 버튼보다 입력칸이 더 세 보입니다.
 * 구분은 **면**이 합니다 — 회색 면(폼) 또는 흰 면 + 그림자(목록 위).
 *
 * 테두리 자체는 투명하게 남겨둡니다. 없애면 포커스·에러로 선이 생길 때
 * 칸 높이가 2px 씩 달라져 화면이 들썩입니다.
 */
const TONE: Record<InputTone, string> = {
  default: 'surface-2 border-transparent',
  /* 흰 입력창이 거의 흰 바탕(canvas) 위에 놓입니다. `shadow-card`(6%) 만으로는
     경계가 사라져 검색창이 있는지도 모릅니다. 그림자를 한 단계 세워 띄웁니다. */
  contrast: 'surface border-transparent shadow-[0_2px_6px_oklch(0_0_0/0.10)]',
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
  onClear,
  showRequirement = false,
  tone = 'default',
  required,
  className,
  id,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  /* 비제어 입력(value 없이 defaultValue 만 주는 폼)에서는 값을 알 수 없어
     지우기 버튼을 띄우지 않습니다. 검색창은 모두 제어 입력입니다. */
  const hasValue = rest.value !== undefined && rest.value !== '';
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
          /* 글자 크기는 **여기서만** 정합니다 (text-base = 16px).
             화면마다 text-[0.9375rem] 같은 걸 덧붙이면 검색창끼리 크기가 어긋나고,
             iOS 사파리는 16px 미만 입력칸에 포커스가 가면 화면을 **확대**합니다
             (한 번 확대되면 사용자가 직접 되돌려야 합니다). */
          className={cn(
            'w-full min-w-0 bg-transparent text-base outline-none disabled:opacity-50',
            className,
          )}
          {...rest}
        />

        {/* 값이 없을 때 자리만 차지하면 입력칸이 좁아 보입니다 — 있을 때만 붙입니다.
            터치 타겟(28px)이 44px 보다 작지만, 옆의 입력 영역이 훨씬 커서
            잘못 눌러도 손해가 없는 동작입니다. */}
        {onClear && hasValue && (
          <button
            type="button"
            aria-label="입력 지우기"
            onClick={onClear}
            className="text-subtle hover:text-ink -mr-1 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        )}

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
