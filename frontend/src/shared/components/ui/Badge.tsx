import type { ReactNode } from 'react';
import { cn } from '@/shared/lib';

type Tone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
type Size = 'sm' | 'md';

/* 색만 보고도 의미가 읽히도록 배경 + 텍스트 + 테두리를 함께 씁니다. */
const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-ink-muted border-line-strong',
  brand: 'bg-brand-900 text-white border-brand-900',
  accent: 'bg-accent-900 text-brand-700 border-line-strong',
  success: 'bg-surface-2 text-ink-muted border-line-strong',
  warning: 'bg-surface-2 text-ink border-line-strong',
  danger: 'bg-danger-soft text-danger border-danger/55',
  info: 'bg-surface-2 text-ink-subtle border-line',
};

/** md 는 목록에서 상태가 바로 읽혀야 하는 곳(공연 카드의 예매중/오픈예정)에 씁니다. */
const SIZE: Record<Size, string> = {
  sm: 'rounded-md px-1.5 py-0.5 text-[0.6875rem] leading-4 gap-1',
  md: 'rounded-lg px-2.5 py-1 text-xs leading-4 gap-1.5',
};

export interface BadgeProps {
  tone?: Tone;
  size?: Size;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** 상태 표시용 라벨. (예매중 / 매진 / 당첨 / RARE …) */
export function Badge({ tone = 'neutral', size = 'sm', icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center border font-semibold whitespace-nowrap',
        TONE[tone],
        SIZE[size],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** 실시간 갱신 중임을 알리는 초록 점 (좌석/구역 화면) */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex size-1.5 shrink-0', className)}>
      <span className="bg-success animate-ring absolute inline-flex size-full rounded-full" />
      <span className="bg-success relative inline-flex size-1.5 rounded-full" />
    </span>
  );
}
