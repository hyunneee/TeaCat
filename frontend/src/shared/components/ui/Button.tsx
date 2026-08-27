import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'danger-ghost';
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

   primary 는 흰 글자 대비를 위해 brand-600 을 씁니다. 500 은 밝아서
   흰 글자가 눈에 부담을 줍니다. */
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700',
  secondary: 'surface-2 text-ink border border-line-strong hover:bg-surface-3',
  soft: 'bg-brand-50 text-brand-800 border border-line-strong hover:bg-brand-100',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95',
  'danger-ghost': 'text-danger border border-danger/40 bg-danger-soft/40 hover:bg-danger-soft',
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
