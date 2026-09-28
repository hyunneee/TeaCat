import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/shared/lib';
import { seatColor } from '../model/yutBoard';
import { pieceStyleOf } from '../model/yutPieces';
import type { GameChatMessage, GameParticipant } from '../model/game.types';

interface Props {
  messages: GameChatMessage[];
  participants: GameParticipant[];
  mySeatNo: number;
  onSend: (message: string) => void;
  sending: boolean;
}

/** 서버가 막는 길이와 같아야 합니다 — 넘겨 보내면 400 만 돌아옵니다 */
const MAX_LENGTH = 200;

/**
 * 방 안의 채팅.
 *
 * <p>게임 기록("0번 자리 도") 자리를 대신합니다. 기록은 판에 이미 그려져 있고 — 말이
 * 어디 있는지, 지금 누구 차례인지 — 같은 것을 글로 한 번 더 읽을 이유가 없습니다.
 * 같이 하는 게임에서 정작 없던 것은 <b>서로 말을 거는 자리</b>였습니다.
 *
 * <p>🔴 <b>내 말과 남의 말을 좌우로 가르지 않습니다.</b> 판이 도는 중에 흘깃 보는
 * 창이라 세로로 좁은데, 좌우로 나누면 한 줄에 담기는 글자가 절반이 됩니다. 대신
 * 자리 색과 말 모양으로 누가 말했는지 구분합니다 — 판 위의 말과 같은 그림입니다.
 */
export function GameChatPanel({ messages, participants, mySeatNo, onSend, sending }: Props) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  // 새 말이 오면 바닥으로. 스크롤을 위로 올려 둔 사람도 끌어내리지만, 이 창은
  // 지금 오가는 말을 보는 곳이라 최신 줄이 가려지는 편이 더 나쁩니다
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  function submit() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    onSend(text);
  }

  return (
    <div className="surface-2 flex flex-col gap-2 rounded-xl p-2">
      <div className="h-28 space-y-1 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-subtle py-6 text-center text-xs">아직 아무 말도 없어요</p>
        ) : (
          messages.map((line) => {
            const color = seatColor(line.seatNo);
            const Icon = pieceStyleOf(
              participants.find((p) => p.seatNo === line.seatNo)?.pieceStyle,
            ).icon;
            return (
              <p key={line.id} className="flex items-start gap-1.5 text-xs leading-snug">
                <span
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-white',
                    color.chip,
                  )}
                >
                  <Icon size={10} strokeWidth={2.6} aria-hidden />
                </span>
                <span className={cn('shrink-0 font-bold', color.text)}>
                  {line.seatNo === mySeatNo ? '나' : line.nickname}
                </span>
                <span className="text-ink min-w-0 break-words">{line.message}</span>
              </p>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {/* 🔴 공용 Input 을 쓰지 않습니다. 이 칸은 게임판 아래 한 줄짜리라 그 컴포넌트의
            라벨·여백·높이(44px)가 판을 밀어냅니다 */}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={MAX_LENGTH}
          placeholder="메시지 보내기"
          aria-label="채팅 메시지"
          className="surface border-border text-ink placeholder:text-subtle min-w-0 flex-1 rounded-full border px-3 py-1.5 text-xs outline-none focus:border-accent-600"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="보내기"
          className="bg-accent-700 flex size-8 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-30"
        >
          <Send size={14} aria-hidden />
        </button>
      </form>
    </div>
  );
}
