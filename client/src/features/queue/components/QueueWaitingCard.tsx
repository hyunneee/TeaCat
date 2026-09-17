import { Users } from 'lucide-react';
import { AnimatedNumber } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import { estimatedWaitLabel } from '../model/queue.model';

interface Props {
  /** 내 순번(1부터). 아직 모르면 null */
  position: number | null;
  /** 내 앞 인원 */
  waitingAhead: number | null;
  /** 예상 대기 초 */
  estimatedWaitSec: number | null;
  className?: string;
}

/**
 * 대기실 카드. 순번 하나를 크게, 나머지는 작게.
 *
 * 숫자는 `AnimatedNumber` 로 부드럽게 바뀝니다 — 폴링마다 튀는 숫자는 "멈춘 것 아닌가" 를 만듭니다.
 * 진행 중인 것은 초록(accent) 하나만 씁니다 (CLAUDE.md 4-6).
 */
export function QueueWaitingCard({ position, waitingAhead, estimatedWaitSec, className }: Props) {
  return (
    <div
      className={cn(
        'surface shadow-card flex flex-col items-center gap-5 rounded-2xl p-6',
        className,
      )}
    >
      <span className="bg-accent-50 text-accent-700 flex size-14 items-center justify-center rounded-full">
        <Users size={26} strokeWidth={1.6} />
      </span>

      <div className="flex flex-col items-center gap-1">
        <p className="text-muted text-sm">내 순번</p>
        {position == null ? (
          <p className="text-4xl font-extrabold tabular-nums">—</p>
        ) : (
          <p className="text-4xl font-extrabold tabular-nums">
            <AnimatedNumber value={position} />
            <span className="text-muted ml-1 text-base font-semibold">번</span>
          </p>
        )}
      </div>

      <dl className="surface-2 grid w-full grid-cols-2 gap-3 rounded-xl p-4 text-center">
        <div>
          <dt className="text-subtle text-xs">앞에 있는 사람</dt>
          <dd className="mt-0.5 font-bold tabular-nums">
            {waitingAhead == null ? '—' : <AnimatedNumber value={waitingAhead} />}
            <span className="text-muted ml-0.5 text-xs font-medium">명</span>
          </dd>
        </div>
        <div>
          <dt className="text-subtle text-xs">예상 대기</dt>
          <dd className="mt-0.5 font-bold">{estimatedWaitLabel(estimatedWaitSec, waitingAhead)}</dd>
        </div>
      </dl>
    </div>
  );
}
