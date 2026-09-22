import { useState } from 'react';
import { Button } from '@/shared/components/ui';
import { YUT_HOME, YUT_THROW_NAMES, seatColor } from '../model/yutBoard';
import type { GameRoom, YutState } from '../model/game.types';
import { YutBoardView } from './YutBoardView';

interface Props {
  room: GameRoom;
  state: YutState;
  onAction: (body: { action: 'THROW' | 'MOVE'; piece?: number; value?: number }) => void;
  pending: boolean;
}

/**
 * 윷놀이 한 판.
 *
 * <p>차례는 <b>던지기 → 말 고르기</b> 입니다. 던진 결과가 여러 개 쌓일 수 있어서(윷·모가
 * 이어지면) 어느 결과로 어느 말을 옮길지 두 번 고르게 합니다. 결과를 먼저 고르고 말을
 * 고르는 순서인 이유는, 말을 먼저 고르면 "이 말로 갈 수 있는 결과" 를 다시 추려 보여줘야
 * 해서 화면이 복잡해지기 때문입니다.
 */
export function YutPanel({ room, state, onAction, pending }: Props) {
  const [value, setValue] = useState<number | null>(null);
  const [piece, setPiece] = useState<number | null>(null);

  const myTurn = state.turn === room.mySeatNo;
  const waiting = state.pending.length > 0;

  function move(pieceIndex: number) {
    const use = value ?? state.pending[0];
    if (use === undefined) return;
    setPiece(null);
    setValue(null);
    onAction({ action: 'MOVE', piece: pieceIndex, value: use });
  }

  const myPieces = state.pieces[room.mySeatNo] ?? [];
  const waitingPieces = myPieces
    .map((position, index) => ({ position, index }))
    .filter((entry) => entry.position === YUT_HOME);

  return (
    <div className="space-y-4">
      <YutBoardView
        state={state}
        mySeatNo={room.mySeatNo}
        selectedPiece={piece}
        onPickPiece={myTurn && waiting ? (index) => { setPiece(index); move(index); } : undefined}
      />

      {/* 던져 놓은 결과들 */}
      {state.pending.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-muted text-xs">쓸 결과</span>
          {state.pending.map((result, index) => (
            <button
              key={`${result}-${index}`}
              type="button"
              disabled={!myTurn}
              onClick={() => setValue(result)}
              className={[
                'rounded-full px-3 py-1 text-sm font-bold',
                (value ?? state.pending[0]) === result
                  ? 'bg-brand-500 text-white'
                  : 'surface-2 text-muted',
              ].join(' ')}
            >
              {YUT_THROW_NAMES[result]}
            </button>
          ))}
        </div>
      )}

      {myTurn ? (
        state.canThrow ? (
          <Button variant="primary" size="lg" fullWidth loading={pending} onClick={() => onAction({ action: 'THROW' })}>
            윷 던지기
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-muted text-center text-sm">움직일 말을 고르세요</p>
            {waitingPieces.length > 0 && (
              <Button
                variant="secondary"
                size="md"
                fullWidth
                loading={pending}
                onClick={() => {
                  const first = waitingPieces[0];
                  if (first) move(first.index);
                }}
              >
                새 말 꺼내기 (대기 {waitingPieces.length}개)
              </Button>
            )}
          </div>
        )
      ) : (
        <p className="text-muted text-center text-sm">
          <span className={seatColor(state.turn).text}>
            {room.participants.find((p) => p.seatNo === state.turn)?.nickname ?? `${state.turn + 1}번`}
          </span>
          님의 차례예요
        </p>
      )}

      {/* 최근 기록. 뒤집힌 순서로 보여야 방금 일어난 일이 위에 옵니다 */}
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
