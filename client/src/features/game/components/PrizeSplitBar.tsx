import { cn } from '@/shared/lib';
import { seatColor } from '../model/yutBoard';
import type { GameParticipant } from '../model/game.types';

interface Props {
  /** 등수 순으로 정렬된 참가자 */
  ranked: GameParticipant[];
  /** 나뉘기 전의 전체 상금 (판돈 합계 + 보조금) */
  prizePool: number;
  /** 1인당 판돈 — 막대 아래에 "어디서 왔나" 를 적는 데 씁니다 */
  betAmount: number;
  subsidy: number;
}

/** 이보다 얇은 조각에는 글씨를 넣지 않습니다. 넣으면 잘려서 더 못 읽습니다 */
const LABEL_MIN_PERCENT = 14;

/**
 * 판돈이 등수별로 어떻게 나뉘었나.
 *
 * <p>🔴 <b>숫자만 나열하면 "왜 내가 이만큼인지" 가 안 보입니다.</b> 예전 결과 화면은
 * 사람마다 순손익 한 줄이 전부여서, 2등이 왜 1등의 절반을 받는지·티캣이 얹어준 돈이
 * 어디에 섞였는지 알 수 없었습니다. 그래서 <b>하나의 막대</b>를 등수만큼 갈라 보여줍니다 —
 * 막대 전체가 곧 모인 돈이고, 조각의 <b>너비가 곧 비율</b>입니다.
 *
 * <p>금액도 비율도 <b>서버가 준 값 그대로</b>입니다. 여기서 계산하지 않습니다 — 화면이
 * 나누면 서버의 반올림과 어긋나 "합이 안 맞는" 그림이 됩니다. 너비만 백분율로 옮깁니다.
 */
export function PrizeSplitBar({ ranked, prizePool, betAmount, subsidy }: Props) {
  if (prizePool <= 0) return null;

  const slices = ranked
    .map((participant) => ({
      participant,
      payout: participant.payout ?? 0,
      percent: ((participant.payout ?? 0) / prizePool) * 100,
    }))
    .filter((slice) => slice.payout > 0);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-muted text-xs">모인 상금</p>
        <p className="text-sm font-black tabular-nums">{prizePool.toLocaleString()} 캣머니</p>
      </div>

      {/* 막대 한 줄 = 상금 전부. 조각 너비가 곧 등수별 몫입니다 */}
      <div
        className="surface-2 flex h-9 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`상금 ${prizePool.toLocaleString()} 캣머니를 ${slices
          .map((s) => `${s.participant.nickname} ${s.payout.toLocaleString()}`)
          .join(', ')} 로 나눴어요`}
      >
        {slices.map(({ participant, percent }) => (
          <div
            key={participant.seatNo}
            style={{ width: `${percent}%` }}
            className={cn(
              'flex items-center justify-center text-[10px] font-black text-white',
              seatColor(participant.seatNo).chip,
            )}
          >
            {percent >= LABEL_MIN_PERCENT && `${Math.round(percent)}%`}
          </div>
        ))}
      </div>

      {/* 조각이 얇아 글씨가 빠진 사람도 여기서는 보입니다 */}
      <ul className="space-y-1">
        {slices.map(({ participant, payout, percent }) => (
          <li key={participant.seatNo} className="flex items-center gap-2 text-xs">
            <span className={cn('size-2.5 shrink-0 rounded-full', seatColor(participant.seatNo).chip)} />
            <span className="min-w-0 flex-1 truncate">
              {participant.rank}등 {participant.me ? '나' : participant.nickname}
            </span>
            <span className="text-subtle shrink-0 tabular-nums">{Math.round(percent)}%</span>
            <span className="shrink-0 font-bold tabular-nums">{payout.toLocaleString()}</span>
          </li>
        ))}
      </ul>

      <p className="text-muted text-[11px] leading-snug">
        {ranked.length}명이 {betAmount.toLocaleString()}씩 걸어
        {' '}{(betAmount * ranked.length).toLocaleString()}
        {subsidy > 0 && ` + 티캣이 ${subsidy.toLocaleString()}을 얹어`}
        {' '}모두 {prizePool.toLocaleString()} 캣머니가 모였어요.
      </p>
    </div>
  );
}
