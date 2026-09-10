import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib';
import { Spinner } from './Spinner';

type Variant =
  'primary' | 'dark' | 'secondary' | 'soft' | 'outline' | 'ghost' | 'danger' | 'danger-ghost';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** true 면 스피너를 띄우고 클릭을 막습니다. 중복 결제 방어의 1차 방어선. */
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/* 스타일 변형은 이렇게 테이블로 관리합니다.
   새 변형이 필요하면 아래 객체에 한 줄 추가 — 컴포넌트 본문은 건드리지 않습니다.

   ⚠️ 되돌릴 수 없는 동작(로그아웃/탈퇴/예매취소/판매내리기)은 반드시
      danger 또는 danger-ghost 를 쓰세요. (DESIGN.md 의미 색상 규칙)

   ── 언제 무엇을 쓰나 ─────────────────────────────────────
   primary(초록)  **돈이나 좌석이 오가는 확정 버튼**에만.
                  결제·구매·판매 등록·좌석 확정·당첨 예매.
   dark(검정)     그 화면의 주 행동이지만 거래는 아닌 것.
                  로그인·가입·얼굴 등록·티켓 보기.
   secondary      보조 행동. ghost 는 그보다 더 약한 것.

   초록이 화면마다 나오면 그건 더 이상 강조가 아닙니다.
   한 화면에 primary 는 하나입니다 — 둘이면 둘 다 안 눌립니다. */
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent-700 text-white hover:bg-accent-600 active:bg-accent-800',
  dark: 'bg-brand-900 text-white hover:bg-brand-800 active:bg-brand-950',
  /* 테두리를 두지 않습니다 — 버튼이 둘 이상 나란히 놓이면 선이 겹쳐 지저분해집니다.
     구분은 **면의 밝기**가 합니다. */
  secondary: 'surface text-ink shadow-card hover:bg-surface-2',
  soft: 'surface-2 text-ink hover:bg-surface-3',
  /* 홀로 놓이는 되돌리기 버튼 — 면만으로는 눌러야 할 것으로 안 읽혀서 테두리를 둡니다.
     버튼이 나란히 놓이는 자리에는 쓰지 마세요(선이 겹칩니다). */
  outline: 'surface text-ink border-line-strong border-2 hover:bg-surface-2',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95',
  'danger-ghost': 'text-danger bg-danger-soft hover:brightness-97',
};

const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-[0.9375rem] rounded-xl gap-2',
  lg: 'h-13 px-6 text-base rounded-xl gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // type 을 명시하지 않으면 form 안에서 submit 으로 동작해 사고가 납니다.
      type="button"
      disabled={disabled ?? loading}
      aria-busy={loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold',
        'transition-[background-color,border-color,filter,transform] duration-150',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
        'touch-manipulation select-none',
        VARIANT[variant],
        SIZE[size],
        // fullWidth 버튼을 flex row 에 나란히 두는 경우(로그인/회원가입, 취소/확인)가 많습니다.
        // shrink-0 을 그대로 두면 100% 폭 버튼 둘이 줄어들지 못해 화면 밖으로 넘칩니다.
        fullWidth ? 'w-full min-w-0 shrink' : 'shrink-0',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : leftIcon}
      <span className="truncate">{children}</span>
      {!loading && rightIcon}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 아이콘만 있는 버튼은 스크린리더용 이름이 반드시 필요합니다. */
  label: string;
  variant?: Extract<Variant, 'ghost' | 'secondary' | 'soft' | 'danger-ghost'>;
  size?: Size;
}

const ICON_SIZE: Record<Size, string> = {
  sm: 'size-8 rounded-lg',
  md: 'size-10 rounded-xl',
  lg: 'size-12 rounded-xl',
};

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors duration-150',
        'active:scale-95 disabled:pointer-events-none disabled:opacity-40',
        VARIANT[variant],
        ICON_SIZE[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
