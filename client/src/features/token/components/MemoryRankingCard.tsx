import { Crown, Timer } from 'lucide-react';
import { Card } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import { formatClock } from '../model/memoryGame.model';
import type { MemoryRankEntry, MemoryRanking } from '../model/memoryRanking.types';

interface Props {
  ranking: MemoryRanking | undefined;
  loading?: boolean;
}

/** 1·2·3등만 색을 답니다. 넷째부터는 숫자만 있어도 순서가 읽힙니다 */
const MEDAL: Record<number, string> = {
  1: 'bg-accent-700 text-white',
  2: 'surface-2 text-ink',
  3: 'surface-2 text-ink-muted',
};

function RankRow({ entry }: { entry: MemoryRankEntry }) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 px-4 py-2.5',
        /* 내 줄만 면으로 띄웁니다. 색을 쓰면 1등 강조와 싸웁니다 (CLAUDE.md 4-6) */
        entry.me && 'surface-2',
      )}
    >
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
          MEDAL[entry.rank] ?? 'text-ink-subtle',
        )}
      >
        {entry.rank}
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-sm', entry.me && 'font-bold')}>
        {entry.nickname}
        {entry.me && <span className="text-subtle ml-1 text-xs">나</span>}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {formatClock(entry.elapsedMs)}
      </span>
    </li>
  );
}

/**
 * 오늘의 짝 맞추기 랭킹.
 *
 * 순위는 **걸린 시간이 짧은 순**이고, 사람마다 그날 가장 빠른 판 하나만 오릅니다.
 * 어제 1등을 맨 아래 붙이는 이유는 규칙을 믿게 하기 위해서입니다 — "1등하면 내일 받는다" 만
 * 적어 두면 진짜 주는지 알 수 없습니다.
 */
export function MemoryRankingCard({ ranking, loading = false }: Props) {
  const entries = ranking?.entries ?? [];

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="border-line flex items-center gap-2 border-b px-4 py-3">
        <Timer size={16} className="text-brand-500 shrink-0" aria-hidden />
        <p className="flex-1 text-sm font-bold">오늘의 순위</p>
        {!!ranking?.prize && (
          <p className="text-subtle text-xs">
            1등 <span className="font-bold">{ranking.prize.toLocaleString()}</span> 캣머니
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-subtle px-4 py-6 text-center text-sm">순위를 불러오는 중</p>
      ) : entries.length === 0 ? (
        <p className="text-subtle px-4 py-6 text-center text-sm">
          아직 아무도 못 깼어요. 지금 하면 1등이에요.
        </p>
      ) : (
        <ul className="divide-line divide-y">
          {entries.map((entry) => (
            <RankRow key={entry.rank} entry={entry} />
          ))}
          {/* 순위표 밖이면 내 줄을 따로 붙입니다 — 몇 등인지 모르면 다시 할 이유가 없습니다 */}
          {ranking?.myRank && (
            <li className="border-line border-t-2 border-dashed p-0">
              <ul>
                <RankRow entry={ranking.myRank} />
              </ul>
            </li>
          )}
        </ul>
      )}

      {/* 🔴 어제 1등이 없어도 이 줄은 그립니다. 예전에는 winner 가 null 이면 통째로 빠져서
          "어제 1등을 보여준다" 는 기능이 있는지조차 알 수 없었습니다 — 순위표가 비었을 때와
          기능이 없을 때가 화면에서 똑같이 보입니다. */}
      {!loading && (
        <div className="border-line text-subtle flex items-center gap-1.5 border-t px-4 py-2.5 text-xs">
          <Crown size={13} className="shrink-0" aria-hidden />
          {ranking?.yesterdayWinner ? (
            <>
              어제 1등
              <span className="text-ink-muted font-semibold">
                {ranking.yesterdayWinner.nickname}
              </span>
              <span className="tabular-nums">{formatClock(ranking.yesterdayWinner.elapsedMs)}</span>
            </>
          ) : (
            <>어제는 아무도 못 깼어요</>
          )}
        </div>
      )}
    </Card>
  );
}
