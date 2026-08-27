import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/shared/hooks';
import { cn } from '@/shared/lib';

export interface AnimatedNumberProps {
  value: number;
  /** 'price' 면 12,000원 / 'plain' 이면 12,000 */
  format?: 'price' | 'plain';
  className?: string;
  durationMs?: number;
}

const KRW = new Intl.NumberFormat('ko-KR');

/**
 * 숫자가 목표값까지 굴러 올라갑니다. (합계 금액, 토큰 잔액 등)
 * 금액이 툭 바뀌면 "바뀐 줄" 모릅니다. 짧게 굴려주면 변화가 인지됩니다.
 *
 * ⚠️ requestAnimationFrame 은 탭이 백그라운드면 아예 돌지 않습니다.
 *    그래서 숨겨진 상태에서 값이 도착하면 숫자가 0 에 갇힙니다.
 *    (예: 홈에서 잔액이 0 으로 표시되고 안 바뀜)
 *    → 숨겨져 있으면 애니메이션 없이 값만 맞추고,
 *      진행 중에 숨겨지면 즉시 최종값으로 확정합니다.
 */
export function AnimatedNumber({
  value,
  format = 'plain',
  className,
  durationMs = 420,
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const settle = () => {
      setDisplay(value);
      fromRef.current = value;
    };

    const from = fromRef.current;
    if (from === value) return;
    if (reduced || document.hidden) {
      settle();
      return;
    }

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else settle();
    };

    raf = requestAnimationFrame(tick);

    const onVisibilityChange = () => {
      if (!document.hidden) return;
      cancelAnimationFrame(raf);
      settle();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [value, durationMs, reduced]);

  return (
    <span className={cn('tabular-nums', className)}>
      {KRW.format(display)}
      {format === 'price' && '원'}
    </span>
  );
}
