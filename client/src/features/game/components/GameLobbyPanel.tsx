import { Check, Copy, Crown, Users } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Card } from '@/shared/components/ui';
import { toast } from '@/shared/stores';
import { seatColor } from '../model/yutBoard';
import { PIECE_STYLES, pieceStyleOf } from '../model/yutPieces';
import type { GamePieceStyle, GameRoom } from '../model/game.types';

interface Props {
  room: GameRoom;
  onReady: (ready: boolean) => void;
  onPickPieceStyle: (style: GamePieceStyle) => void;
  onStart: () => void;
  busy: boolean;
  /** 대기실에서도 말을 겁니다 — 사람을 모으는 동안 할 일이 이것뿐입니다 */
  chat: ReactNode;
}

/** 시작 전 대기실 — 초대 코드를 나눠주고 사람이 모이길 기다립니다 */
export function GameLobbyPanel({ room, onReady, onPickPieceStyle, onStart, busy, chat }: Props) {
  const [copied, setCopied] = useState(false);
  const me = room.participants.find((p) => p.me);
  const yut = room.gameType === 'YUT';

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
          {room.participants.map((participant) => {
            const PieceIcon = pieceStyleOf(participant.pieceStyle).icon;
            return (
            <li key={participant.seatNo} className="flex items-center gap-2">
              <span
                className={`flex size-6 items-center justify-center rounded-full text-white ${seatColor(participant.seatNo).chip}`}
              >
                {yut ? <PieceIcon size={14} strokeWidth={2.4} aria-hidden /> : null}
              </span>
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
            );
          })}
        </ul>
      </Card>

      {/* 말 고르기 — 윷놀이만 */}
      {yut && (
        <Card className="space-y-3">
          <p className="text-sm font-bold">내 말 고르기</p>
          <p className="text-muted text-xs">
            1인당 말 {room.piecesPerPlayer}개로 해요. 같은 말은 한 사람만 쓸 수 있어요.
          </p>
          <div className="grid grid-cols-6 gap-2">
            {PIECE_STYLES.map(({ key, label, icon: Icon }) => {
              const owner = room.participants.find((p) => p.pieceStyle === key);
              const mine = owner?.me === true;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={busy || (owner !== undefined && !mine)}
                  onClick={() => onPickPieceStyle(key)}
                  aria-label={label}
                  aria-pressed={mine}
                  className={[
                    'flex aspect-square items-center justify-center rounded-xl transition',
                    mine ? 'bg-brand-500 text-white' : 'surface-2 text-muted',
                    /* 남이 쓰는 말은 흐리게 둡니다 — 없애 버리면 칸이 밀려서 어느 말이
                       사라졌는지 알 수 없습니다 */
                    owner && !mine ? 'opacity-30' : '',
                  ].join(' ')}
                >
                  <Icon size={20} strokeWidth={2.2} aria-hidden />
                </button>
              );
            })}
          </div>
        </Card>
      )}

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

      {chat}

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
