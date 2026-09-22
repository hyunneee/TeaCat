import { Button } from '@/shared/components/ui';
import { seatColor } from '../model/yutBoard';
import type { GameRoom, HalliGalliCard, HalliGalliState } from '../model/game.types';

interface Props {
  room: GameRoom;
  state: HalliGalliState;
  onAction: (body: { action: 'FLIP' | 'BELL' }) => void;
  pending: boolean;
}

const FRUIT_EMOJI: Record<HalliGalliCard['fruit'], string> = {
  STRAWBERRY: '🍓',
  BANANA: '🍌',
  LIME: '🍋',
  PLUM: '🫐',
};

const FRUIT_NAME: Record<HalliGalliCard['fruit'], string> = {
  STRAWBERRY: '딸기',
  BANANA: '바나나',
  LIME: '라임',
  PLUM: '자두',
};

/**
 * 할리갈리 한 판.
 *
 * <p>🔴 <b>종을 칠 수 있는지 화면이 판단하지 않습니다.</b> 보이는 카드로 계산해서 버튼을
 * 잠그면 그게 곧 정답 표시가 되어, 눈으로 세는 게임이 아니라 버튼이 켜지길 기다리는
 * 게임이 됩니다. 언제나 누를 수 있고, 맞았는지는 서버가 정합니다.
 */
export function HalliGalliPanel({ room, state, onAction, pending }: Props) {
  const myTurn = state.turn === room.mySeatNo;
  const alive = !state.eliminated[room.mySeatNo];

  return (
    <div className="space-y-4">
      {/* 각자 펼쳐 놓은 더미. 맨 위 카드만 보입니다 */}
      <div className="grid grid-cols-2 gap-3">
        {room.participants.map((participant) => {
          const seat = participant.seatNo;
          const top = state.piles[seat]?.[0];
          const out = state.eliminated[seat];
          const color = seatColor(seat);
          return (
            <div
              key={seat}
              className={[
                'surface-2 flex flex-col items-center gap-2 rounded-2xl p-3',
                state.turn === seat && !out ? `ring-2 ${color.ring}` : '',
                out ? 'opacity-40' : '',
              ].join(' ')}
            >
              <div className="flex w-full items-center justify-between">
                <span className={`truncate text-xs font-bold ${color.text}`}>
                  {participant.nickname}
                  {participant.me && ' (나)'}
                </span>
                <span className="text-muted text-[10px]">{state.handCounts[seat] ?? 0}장</span>
              </div>

              <div className="surface-1 border-border flex h-24 w-full items-center justify-center rounded-xl border">
                {top ? (
                  <div className="text-center">
                    <div className="text-3xl leading-none">{FRUIT_EMOJI[top.fruit]}</div>
                    <div className="text-muted mt-1 text-xs">
                      {FRUIT_NAME[top.fruit]} {top.count}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted text-xs">{out ? '탈락' : '없음'}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 방금 종 결과 */}
      {state.lastBellSeat !== null && (
        <p
          className={[
            'text-center text-sm font-bold',
            state.lastBellCorrect ? 'text-emerald-600' : 'text-rose-600',
          ].join(' ')}
        >
          {room.participants.find((p) => p.seatNo === state.lastBellSeat)?.nickname ?? ''} 님이 종을 쳤어요 —{' '}
          {state.lastBellCorrect ? '성공! 카드를 가져갔어요' : '실패! 한 장씩 물어줬어요'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          disabled={!myTurn || !alive}
          loading={pending && myTurn}
          onClick={() => onAction({ action: 'FLIP' })}
        >
          {myTurn ? '카드 뒤집기' : '내 차례 아님'}
        </Button>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!alive}
          onClick={() => onAction({ action: 'BELL' })}
        >
          🔔 종 치기
        </Button>
      </div>

      <p className="text-muted text-center text-xs">
        보이는 카드 중 같은 과일이 <b>정확히 5개</b>일 때 종을 치세요. 틀리면 한 장씩 물어줍니다.
      </p>

      {state.log.length > 0 && (
        <div className="surface-2 max-h-28 space-y-1 overflow-y-auto rounded-xl p-3">
          {[...state.log].reverse().slice(0, 8).map((line, index) => (
            <p key={index} className="text-muted text-xs">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
