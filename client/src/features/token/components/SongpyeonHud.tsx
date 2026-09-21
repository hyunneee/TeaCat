import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { STAGE_COUNT, STAGE_MS } from '../model/songpyeonGame.model';

interface Props {
  /** 이번 단계가 시작된 시각(ms). null 이면 시계가 멈춰 있습니다 */
  stageStartedAt: number | null;
  stage: number;
}

/** 0.1초 단위로 흐릅니다. 초 단위로만 움직이면 멈춰 있는 것처럼 보입니다 */
const TICK_MS = 100;

/**
 * 판 위의 한 줄 — 몇 단계인지와 남은 시간.
 *
 * 🔴 **남은 시간을 세는 곳은 이 파일 하나뿐입니다.** 게임 훅이 흐르는 시간을 state 로 들고
 * 있으면 0.1초마다 판의 조각이 전부 다시 그려집니다 (`useSongpyeonGame` 주석).
 *
 * 짙은 면 위에 올라가므로 색을 직접 적지 않고 글자색을 물려받아 투명도로만 층을 만듭니다 —
 * 여기서 `text-muted` 를 쓰면 어두운 회색이라 안 보입니다. (`MemoryHud` 와 같은 규칙)
 */
export function SongpyeonHud({ stageStartedAt, stage }: Props) {
  const remainMs = useRemaining(stageStartedAt);
  const ratio = remainMs / STAGE_MS;

  return (
    <div className="shrink-0 space-y-2 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold">
          {stage}단계
          <span className="opacity-55"> / {STAGE_COUNT}</span>
        </p>

        <p className="flex items-center gap-1.5 text-xl font-extrabold tabular-nums">
          <Timer size={18} className="opacity-60" aria-hidden />
          {(remainMs / 1000).toFixed(1)}초
        </p>
      </div>

      {/* 남은 시간 막대. 숫자만 있으면 곁눈질로 안 읽힙니다 —
          판에서 눈을 떼지 않고도 얼마 남았는지 보이게 합니다.
          🔴 다 되어 갈 때 붉게 바꾸지 않습니다. 붉은색은 "되돌릴 수 없는 동작" 자리입니다
             (CLAUDE.md 4-6·4-7). 여기서는 길이만으로 말합니다 */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-white/70 transition-[width] duration-100 ease-linear"
          style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * 남은 시간.
 *
 * ⚠️ 0.1초씩 빼 나가지 않고 **매번 시작 시각과의 차이를 다시 잽니다.** 빼 나가면 탭이
 * 백그라운드로 가 있는 동안 타이머가 느려져 실제보다 길게 남습니다 (`MemoryHud` 와 같은 이유).
 */
function useRemaining(stageStartedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (stageStartedAt === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [stageStartedAt]);

  if (stageStartedAt === null) return 0;
  return Math.max(0, STAGE_MS - (now - stageStartedAt));
}
