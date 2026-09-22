import { Check, Copy, Crown, Users } from 'lucide-react';
import { useState } from 'react';
import { Button, Card } from '@/shared/components/ui';
import { toast } from '@/shared/stores';
import { seatColor } from '../model/yutBoard';
import type { GameRoom } from '../model/game.types';

interface Props {
  room: GameRoom;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  busy: boolean;
}

/** 시작 전 대기실 — 초대 코드를 나눠주고 사람이 모이길 기다립니다 */
export function GameLobbyPanel({ room, onReady, onStart, busy }: Props) {
  const [copied, setCopied] = useState(false);
  const me = room.participants.find((p) => p.me);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드를 막아 둔 브라우저가 있습니다. 코드는 화면에 이미 크게 떠 있습니다
      toast.error('복사하지 못했어요. 코드를 직접 입력해 주세요.');
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 text-center">
        <p className="text-muted text-xs">초대 코드</p>
        <p className="text-brand-600 font-mono text-4xl font-black tracking-[0.3em]">{room.inviteCode}</p>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
          onClick={() => void copyCode()}
        >
          {copied ? '복사했어요' : '코드 복사'}
        </Button>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-muted" />
          <p className="text-sm font-bold">
            참가자 {room.participants.length} / {room.maxPlayers}
          </p>
        </div>

        <ul className="space-y-2">
          {room.participants.map((participant) => (
            <li key={participant.seatNo} className="flex items-center gap-2">
              <span className={`size-3 rounded-full ${seatColor(participant.seatNo).chip}`} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {participant.nickname}
                {participant.me && <span className="text-muted"> (나)</span>}
              </span>
              {participant.host && <Crown size={14} className="text-amber-500" />}
              {!participant.host && (
                <span
                  className={[
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    participant.ready ? 'bg-emerald-100 text-emerald-700' : 'surface-2 text-muted',
                  ].join(' ')}
                >
                  {participant.ready ? '준비' : '대기'}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {room.betAmount > 0 && (
        <Card className="space-y-1">
          <p className="text-sm font-bold">
            1인당 판돈 {room.betAmount.toLocaleString()} 캣머니
          </p>
          <p className="text-muted text-xs">
            지금 걸린 상금 {room.prizePool.toLocaleString()} 캣머니
            {room.subsidy > 0 && ` (그중 ${room.subsidy.toLocaleString()}은 티캣이 얹어줘요)`}
          </p>
          <p className="text-muted text-xs">
            🔴 시작한 뒤에 나가면 판돈을 돌려받지 못하고 꼴찌로 정산돼요.
          </p>
        </Card>
      )}

      {room.host ? (
        <Button variant="primary" size="lg" fullWidth loading={busy} onClick={onStart}>
          게임 시작
        </Button>
      ) : (
        <Button
          variant={me?.ready ? 'secondary' : 'primary'}
          size="lg"
          fullWidth
          loading={busy}
          onClick={() => onReady(!me?.ready)}
        >
          {me?.ready ? '준비 취소' : '준비 완료'}
        </Button>
      )}
    </div>
  );
}
