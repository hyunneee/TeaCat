import type { ReactNode } from 'react';
import { cn } from '@/shared/lib';

type Tone =
  | 'neutral'
  | 'brand'
  /** 옅은 강조 면 — 목록에 여러 개 놓여도 시끄럽지 않습니다 */
  | 'accent'
  /** 진한 강조 면 — 화면에 하나뿐일 때만 (당첨, 단일 CTA 라벨) */
  | 'accent-solid'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';
type Size = 'sm' | 'md' | 'lg';

/* 색만 보고도 의미가 읽히도록 배경 + 텍스트 + 테두리를 함께 씁니다. */
const TONE: Record<Tone, string> = {
  neutral: 'surface text-ink border-line',
  brand: 'bg-brand-900 text-white border-brand-900',
  accent: 'bg-accent-50 text-accent-800 border-accent-300',
  'accent-solid': 'bg-accent-700 text-white border-accent-700',
  success: 'bg-surface-2 text-ink-muted border-line-strong',
  warning: 'bg-surface-2 text-ink border-line-strong',
  danger: 'bg-danger-soft text-danger border-danger/55',
  info: 'bg-surface-2 text-ink-subtle border-line',
};

/**
 * sm 은 카드 안 보조 표시, md 는 목록의 상태,
 * lg 는 **그 카드에서 가장 먼저 읽혀야 하는 상태**(홈의 "예매중")에 씁니다.
 */
const SIZE: Record<Size, string> = {
  sm: 'rounded-md px-1.5 py-0.5 text-[0.6875rem] leading-4 gap-1',
  md: 'rounded-lg px-2.5 py-1 text-xs leading-4 gap-1.5',
  lg: 'rounded-lg px-3 py-1.5 text-[0.8125rem] leading-5 gap-1.5',
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
      {/* 방송의 LIVE 표시와 같은 관습입니다 — 붉은 점은 "지금 열려 있다" 를 뜻합니다.
          이 붉은색은 위험 신호가 아니라 **살아 있음**의 신호라, danger 와 역할이 다릅니다. */}
      <span className="bg-danger animate-breathe absolute inline-flex size-full rounded-full" />
      <span className="bg-danger relative inline-flex size-1.5 rounded-full" />
    </span>
  );
}
