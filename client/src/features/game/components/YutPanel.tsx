import { useEffect, useRef, useState } from 'react';
import { Flag, Home } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import { YUT_GOAL, YUT_HOME, YUT_THROW_NAMES, seatColor, yutAdvance } from '../model/yutBoard';
import { pieceStyleOf } from '../model/yutPieces';
import type { GameParticipant, GameRoom, YutState } from '../model/game.types';
import { YutBoardView } from './YutBoardView';
import type { Destination } from './YutBoardView';

interface Props {
  room: GameRoom;
  state: YutState;
  onAction: (body: { action: 'THROW' | 'MOVE'; piece?: number; value?: number }) => void;
  pending: boolean;
}

/** 던진 결과가 화면 한가운데에 머무는 시간 */
const THROW_FLASH_MS = 1600;

/**
 * 윷놀이 한 판.
 *
 * <p>차례는 <b>던지기 → 말 고르기</b> 입니다. 던진 결과가 여러 개 쌓일 수 있어서(윷·모가
 * 이어지면) 어느 결과로 어느 말을 옮길지 두 번 고르게 합니다. 결과를 먼저 고르고 말을
 * 고르는 순서인 이유는, 말을 먼저 고르면 "이 말로 갈 수 있는 결과" 를 다시 추려 보여줘야
 * 해서 화면이 복잡해지기 때문입니다.
 *
 * <p>고른 결과로 <b>갈 수 있는 자리를 판 위에 띄웁니다.</b> 지름길은 모서리에 정확히
 * 멈춰야 타는 규칙이라, 어디까지 가는지가 눈으로 계산되지 않습니다.
 */
export function YutPanel({ room, state, onAction, pending }: Props) {
  const [value, setValue] = useState<number | null>(null);

  const myTurn = state.turn === room.mySeatNo;
  const waiting = state.pending.length > 0;
  const use = value ?? state.pending[0] ?? null;

  const flash = useThrowFlash(state.lastThrow, state.lastThrowSeat, state.throwSeq);
  const thrower = room.participants.find((p) => p.seatNo === flash?.seat);

  function move(pieceIndex: number) {
    if (use === null) return;
    setValue(null);
    onAction({ action: 'MOVE', piece: pieceIndex, value: use });
  }

  const myPieces = state.pieces[room.mySeatNo] ?? [];
  const waitingPieces = myPieces
    .map((position, index) => ({ position, index }))
    .filter((entry) => entry.position === YUT_HOME);

  /**
   * 지금 고른 결과로 갈 수 있는 자리들.
   *
   * 🔴 한 밭에 여럿이 겹쳐 서 있으면 **말 하나만** 넣습니다 — 업은 말은 어차피 함께
   * 움직이고, 대기 중인 말도 한 번에 하나만 꺼냅니다.
   */
  const destinations: Destination[] =
    myTurn && waiting && use !== null
      ? dedupe(
          myPieces
            .map((position, pieceIndex) => ({ position, pieceIndex }))
            .filter((entry) => entry.position !== YUT_GOAL)
            .map(({ position, pieceIndex }) => ({ pieceIndex, to: yutAdvance(position, use) })),
        )
      : [];

  return (
    <div className="relative space-y-4">
      <YutBoardView
        state={state}
        participants={room.participants}
        destinations={destinations}
        onPickPiece={myTurn && waiting ? move : undefined}
      />

      {/* 던진 결과 — 화면 한가운데에 크게. 던진 사람만이 아니라 모두가 봅니다 */}
      {flash && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}

          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center"
        >
          <div className="surface flex flex-col items-center gap-1 rounded-3xl px-8 py-5 shadow-xl">
            <span className={cn('text-5xl font-black', seatColor(flash.seat).text)}>
              {YUT_THROW_NAMES[flash.result]}
            </span>
            <span className="text-muted text-xs">
              {thrower?.me ? '내가' : (thrower?.nickname ?? `${flash.seat + 1}번`)} 던졌어요
            </span>
          </div>
        </motion.div>
      )}

      {/* 사람별 말 현황 — 전체 / 대기 / 판 위 / 완주 */}
      <div className="grid grid-cols-2 gap-2">
        {room.participants.map((participant) => (
          <SeatPieces
            key={participant.seatNo}
            participant={participant}
            state={state}
            turn={state.turn === participant.seatNo}
          />
        ))}
      </div>

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
              className={cn(
                'rounded-full px-3 py-1 text-sm font-bold',
                use === result ? 'bg-brand-500 text-white' : 'surface-2 text-muted',
              )}
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
            <p className="text-muted text-center text-sm">판에서 갈 자리를 누르세요</p>
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

/**
 * 한 사람의 말 현황.
 *
 * <p>전체 몇 개를 가지고 시작했고, 그중 <b>아직 안 꺼낸 것 · 판 위 · 완주</b>가 몇 개인지
 * 셋으로 나눠 보여줍니다. 완주한 말은 회색이 아니라 <b>깃발</b>로 표시합니다 — 흐리게
 * 두면 "없어진 말" 로 읽히는데 사실은 이겨서 나간 말입니다.
 */
function SeatPieces({
  participant,
  state,
  turn,
}: {
  participant: GameParticipant;
  state: YutState;
  turn: boolean;
}) {
  const seat = participant.seatNo;
  const mine = state.pieces[seat] ?? [];
  const color = seatColor(seat);
  const Icon = pieceStyleOf(participant.pieceStyle).icon;

  const home = mine.filter((position) => position === YUT_HOME).length;
  const done = mine.filter((position) => position === YUT_GOAL).length;
  const onBoard = mine.length - home - done;
  const out = state.retired[seat] === true;

  return (
    <div
      className={cn(
        'surface-2 flex items-center gap-2 rounded-xl p-2 transition',
        turn && `ring-2 ${color.ring}`,
        out && 'opacity-40',
      )}
    >
      <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-white', color.chip)}>
        <Icon size={15} strokeWidth={2.4} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold">
          {participant.me ? '나' : participant.nickname}
          {out && <span className="text-muted"> · 나감</span>}
        </p>
        <p className="text-subtle flex items-center gap-1.5 text-[10px] tabular-nums">
          <span className="flex items-center gap-0.5">
            <Home size={9} aria-hidden />
            {home}
          </span>
          <span aria-label="판 위">판 {onBoard}</span>
          <span className="flex items-center gap-0.5 font-bold text-emerald-600">
            <Flag size={9} aria-hidden />
            {done}
          </span>
          <span className="text-subtle">/ {mine.length}</span>
        </p>
      </div>
    </div>
  );
}

/** 같은 밭으로 가는 말은 하나만 남깁니다 */
function dedupe(list: Destination[]): Destination[] {
  const seen = new Set<number>();
  return list.filter(({ to }) => {
    if (seen.has(to)) return false;
    seen.add(to);
    return true;
  });
}

/**
 * 방금 던진 결과.
 *
 * <p>서버 상태에는 "마지막 던지기" 만 남아 있어서, 그 값만 보면 <b>한 번 던진 뒤 계속</b>
 * 떠 있게 됩니다. 그래서 `throwSeq` 가 <b>바뀐 순간</b>에만 잠깐 켜고 스스로 끕니다 —
 * 같은 값이 연달아 나와도(모, 모) 번호가 오르므로 새 던지기로 알아봅니다.
 */
function useThrowFlash(result: number | null, seat: number | null, seq: number) {
  const [flash, setFlash] = useState<{ result: number; seat: number } | null>(null);
  const seen = useRef<number | null>(null);

  useEffect(() => {
    if (result === null || seat === null || seq === 0) return;
    if (seen.current === seq) return;
    seen.current = seq;

    setFlash({ result, seat });
    const timer = setTimeout(() => setFlash(null), THROW_FLASH_MS);
    return () => clearTimeout(timer);
  }, [result, seat, seq]);

  return flash;
}
