import { useEffect, useState } from 'react';
import { RotateCcw, Timer } from 'lucide-react';
import { formatClock } from '../model/memoryGame.model';

interface Props {
  /** 시작 시각(ms). null 이면 아직 시작 전 */
  startedAt: number | null;
  /** 끝난 판의 소요 시간. 있으면 초를 세지 않고 이 값을 고정으로 보여줍니다 */
  frozenMs: number | null;
  moves: number;
}

/** 0.1초 단위로 흐릅니다. 초 단위로만 움직이면 멈춰 있는 것처럼 보입니다 */
const TICK_MS = 100;

/**
 * 판 위의 한 줄 — 시간과 뒤집은 횟수.
 *
 * 짙은 면(`surface-strong`) 위에 올라가므로 색을 직접 적지 않고 **글자색을 물려받아**
 * 투명도로만 층을 만듭니다. 여기서 `text-muted` 를 쓰면 어두운 회색이라 안 보입니다.
 *
 * 🔴 **초를 세는 곳은 이 파일 하나뿐입니다.** 게임 훅이 흐르는 시간을 state 로 들고
 * 있으면 0.1초마다 카드 16장이 전부 다시 그려집니다. 여기서 세면 다시 그려지는 것은
 * 숫자 한 줄뿐입니다. (`useMemoryGame` 주석)
 */
export function MemoryHud({ startedAt, frozenMs, moves }: Props) {
  const elapsedMs = useElapsed(frozenMs === null ? startedAt : null, frozenMs ?? 0);

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 py-2">
      <p className="flex items-center gap-1.5 text-xl font-extrabold tabular-nums">
        <Timer size={18} className="opacity-60" aria-hidden />
        {formatClock(elapsedMs)}
      </p>

      <p className="flex items-center gap-1.5 text-sm tabular-nums opacity-65">
        <RotateCcw size={14} aria-hidden />
        {moves}번
      </p>
    </div>
  );
}

/**
 * 흐르는 시간.
 *
 * ⚠️ 0.1초씩 더하지 않고 **매번 시작 시각과의 차이를 다시 잽니다.** 더해 나가면
 * 탭이 백그라운드로 가 있는 동안 타이머가 느려져 실제보다 짧게 나옵니다.
 * (좌석 선점 카운트다운과 같은 이유 — `shared/hooks/useCountdown`)
 */
function useElapsed(startedAt: number | null, fallbackMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [startedAt]);

  if (startedAt === null) return fallbackMs;
  return Math.max(0, now - startedAt);
}
