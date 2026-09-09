import { useEffect, useRef } from 'react';
import { Timer } from 'lucide-react';
import { useCountdown } from '@/shared/hooks';
import { cn, parseServerTime } from '@/shared/lib';
import { formatTimeLeft } from '../model/auction.model';

interface Props {
  /** 서버가 준 마감 시각 문자열 */
  endsAt: string;
  /** 0 이 됐을 때 한 번 부릅니다 — 상세가 이걸로 서버에 결과를 물어봅니다 */
  onEnd?: () => void;
  /** 아이콘을 뺄 때 */
  hideIcon?: boolean;
  className?: string;
}

/**
 * 마감까지 남은 시간.
 *
 * 숫자를 state 에 담아 1초씩 깎지 않고 렌더할 때마다 다시 잽니다(`useCountdown`).
 * 모바일에서 탭이 백그라운드로 가면 타이머가 throttling 돼서, 깎는 방식은
 * 돌아왔을 때 "3분 남음" 인데 서버는 이미 마감인 상태가 됩니다.
 *
 * 0 이 되어도 화면에서 스스로 결론 내지 않습니다. 마감 판정은 서버 시계가 하고,
 * `onEnd` 를 받은 쪽이 다시 물어봅니다.
 */
export function AuctionCountdown({ endsAt, onEnd, hideIcon, className }: Props) {
  const remain = useCountdown(parseServerTime(endsAt));
  const ended = remain === 0;

  /* 0 에 닿을 때 **한 번만** 알립니다.
     렌더 중에 부르면 부모의 setState 가 렌더 도중 일어나 경고가 납니다.
     마감 시각이 바뀌면(다른 경매로 이동) 다시 알릴 수 있게 깃발을 되돌립니다. */
  const firedRef = useRef(false);
  useEffect(() => {
    if (!ended) {
      firedRef.current = false;
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;
    onEnd?.();
  }, [ended, onEnd]);

  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', className)}>
      {!hideIcon && <Timer size={14} className="shrink-0" />}
      {formatTimeLeft(remain)}
    </span>
  );
}
