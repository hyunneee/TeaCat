import { Trophy } from 'lucide-react';
import { Button, Card } from '@/shared/components/ui';
import { seatColor } from '../model/yutBoard';
import type { GameRoom } from '../model/game.types';

interface Props {
  room: GameRoom;
  onLeave: () => void;
  busy: boolean;
}

const MEDALS = ['🥇', '🥈', '🥉', ''];

/**
 * 끝난 판의 결과.
 *
 * <p>🔴 <b>순손익을 같이 보여줍니다.</b> 받은 금액만 보여주면 판돈보다 적게 받은 사람도
 * "얼마 받았다" 로 읽어서, 잃었다는 사실이 가려집니다.
 */
export function GameResultCard({ room, onLeave, busy }: Props) {
  const ranked = [...room.participants].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const practice = room.betAmount === 0;

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy size={18} className="text-amber-500" />
        <p className="font-bold">게임 끝!</p>
      </div>

      <ul className="space-y-2">
        {ranked.map((participant) => {
          const net = (participant.payout ?? 0) - room.betAmount;
          return (
            <li key={participant.seatNo} className="flex items-center gap-2">
              <span className="w-6 text-center text-sm">{MEDALS[(participant.rank ?? 4) - 1] ?? ''}</span>
              <span className={`size-3 rounded-full ${seatColor(participant.seatNo).chip}`} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {participant.nickname}
                {participant.me && <span className="text-muted"> (나)</span>}
                {participant.status === 'RETIRED' && <span className="text-muted text-xs"> · 중도 포기</span>}
              </span>

              {!practice && (
                <span
                  className={[
                    'text-sm font-bold tabular-nums',
                    net > 0 ? 'text-emerald-600' : net < 0 ? 'text-rose-600' : 'text-muted',
                  ].join(' ')}
                >
                  {net > 0 ? '+' : ''}
                  {net.toLocaleString()}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {practice ? (
        <p className="text-muted text-xs">연습 판이라 캣머니는 오가지 않았어요.</p>
      ) : (
        <p className="text-muted text-xs">
          상금 {room.prizePool.toLocaleString()} 캣머니
          {room.subsidy > 0 && ` (그중 ${room.subsidy.toLocaleString()}은 티캣이 얹어준 금액)`}
          {' · '}반영까지 잠깐 걸릴 수 있어요.
        </p>
      )}

      <Button variant="primary" size="lg" fullWidth loading={busy} onClick={onLeave}>
        나가기
      </Button>
    </Card>
  );
}
