import { useEffect, useRef } from 'react';
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

  /**
   * 스페이스바로도 종을 칩니다. 데스크톱에서 손가락으로 화면을 짚는 것보다 훨씬 빠르고,
   * 할리갈리는 **누가 먼저인가**가 곧 승부라 입력 수단이 느리면 규칙이 아니라 기기가
   * 이깁니다. Enter 도 함께 받습니다 — 키보드로 노는 사람이 자연히 누르는 키입니다.
   *
   * 🔴 `keydown` 의 자동 반복을 막습니다(`event.repeat`). 누르고 있으면 초당 수십 번
   * 발사되는데, 종은 틀리면 카드를 물어주는 행동이라 한 번 잘못 누른 것이 연타로
   * 번역되면 손패가 통째로 날아갑니다.
   *
   * 🔴 글자를 입력하는 중에는 가로채지 않습니다. 이 화면에는 입력칸이 없지만, 나중에
   * 채팅이라도 붙으면 스페이스를 칠 때마다 종이 울립니다.
   */
  /* onAction 은 매 렌더 새 함수라 의존성에 그대로 넣으면 렌더마다 구독을 다시 맺는다.
     ref 에 담아 두고 구독은 살아 있는 동안 한 번만 건다 */
  const actionRef = useRef(onAction);
  actionRef.current = onAction;

  useEffect(() => {
    if (!alive || state.finished) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      if (event.repeat) return;

      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      if (typing) return;

      /* 🔴 preventDefault 가 두 가지를 동시에 막는다. 스페이스의 기본 동작인 **스크롤**
         (종을 칠 때마다 화면이 뛰면 카드를 놓친다), 그리고 버튼에 포커스가 있을 때
         브라우저가 만들어내는 **클릭**(그게 없으면 종이 두 번 울린다). */
      event.preventDefault();
      actionRef.current({ action: 'BELL' });
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [alive, state.finished]);

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
        <br />
        <span className="hidden sm:inline">키보드에서는 <b>스페이스바</b>로도 칠 수 있어요.</span>
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
