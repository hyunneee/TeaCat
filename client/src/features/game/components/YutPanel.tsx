import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Flag, Home } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/shared/components/ui';
import { cn, parseServerTime } from '@/shared/lib';
import { useCountdown } from '@/shared/hooks';
import {
  YUT_BACKDO,
  YUT_GOAL,
  YUT_HOME,
  seatColor,
  yutAdvance,
  yutThrowName,
} from '../model/yutBoard';
import { pieceStyleOf } from '../model/yutPieces';
import type { GameParticipant, GameRoom, YutState } from '../model/game.types';
import { YutBoardView } from './YutBoardView';
import { YutSticks } from './YutSticks';
import type { Destination } from './YutBoardView';

interface Props {
  room: GameRoom;
  state: YutState;
  onAction: (body: { action: 'THROW' | 'MOVE'; piece?: number; value?: number }) => void;
  pending: boolean;
  /** 기록 대신 들어가는 채팅 창. 페이지가 만들어 내려줍니다 */
  chat: ReactNode;
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
export function YutPanel({ room, state, onAction, pending, chat }: Props) {
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
  /* 백도가 되돌아갈 곳은 판 모양으로 계산할 수 없습니다 — 지름길이 있어서 같은 칸에
     서로 다른 길로 닿을 수 있기 때문입니다. 서버가 말마다 지나온 칸을 기억해 줍니다.
     🔴 되돌아갈 곳이 판 위가 아니면(아직 안 나왔거나 막 나온 말) **고를 수 없습니다** —
        서버도 같은 기준으로 거절하므로, 여기서 보여주면 눌렀을 때 실패하는 자리가 됩니다 */
  const myPrev = state.prev?.[state.turn];
  const backdoTo = (pieceIndex: number) => myPrev?.[pieceIndex] ?? YUT_HOME;

  const destinations: Destination[] =
    myTurn && waiting && use !== null
      ? dedupe(
          myPieces
            .map((position, pieceIndex) => ({ position, pieceIndex }))
            .filter((entry) => entry.position !== YUT_GOAL)
            .filter((entry) =>
              use === YUT_BACKDO
                ? entry.position !== YUT_HOME && backdoTo(entry.pieceIndex) !== YUT_HOME
                : true,
            )
            .map(({ position, pieceIndex }) => ({
              pieceIndex,
              to: use === YUT_BACKDO ? backdoTo(pieceIndex) : yutAdvance(position, use),
            })),
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

      {/* 던진 결과 — 판 한가운데에 윷가락이 실제로 떨어집니다. 던진 사람만이 아니라
          방에 있는 모두가 같은 것을 봅니다 (서버가 lastThrow 를 내려주기 때문입니다) */}
      {flash && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          /* 🔴 판과 <b>같은 상자</b>여야 가운데가 맞습니다. 판은 max-w-[22rem] 로 가운데
             정렬돼 있어서, 여기에 폭 제한이 없으면 정사각형이 판보다 커지고 윷가락이
             판 아래(버튼 위)로 내려앉습니다 */
          className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto flex aspect-square w-full max-w-[22rem] items-center justify-center"
        >
          <div className="surface flex flex-col items-center gap-2 rounded-3xl px-6 py-4 shadow-xl">
            <YutSticks result={flash.result} seq={flash.seq} />
            <span className={cn('text-3xl font-black leading-none', seatColor(flash.seat).text)}>
              {yutThrowName(flash.result)}
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

      {/* 던져 놓은 결과들.
          🔴 **비어 있어도 자리를 비워 둡니다** (`min-h`). 결과가 생겼다 사라질 때마다
             이 줄이 접히면 아래의 채팅과 나가기 버튼이 통째로 위아래로 뜁니다. */}
      <div className="flex min-h-8 flex-wrap items-center justify-center gap-2">
        {state.pending.length > 0 && <span className="text-muted text-xs">쓸 결과</span>}
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
            {yutThrowName(result)}
          </button>
        ))}
      </div>

      {/* 차례 영역 — 🔴 **높이를 못 박습니다.**

          여기는 상황마다 들어가는 것이 다릅니다. 내 차례에 던질 때는 큰 버튼(52px),
          말을 옮길 때는 안내문 + 작은 버튼(72px), 남의 차례에는 한 줄(20px)입니다.
          그대로 두면 차례가 바뀔 때마다 아래가 **80px 쯤 뛰어**, 채팅을 누르려던 손가락이
          그 아래 나가기 버튼에 닿습니다. 실제로 그렇게 나가집니다.

          그래서 **가장 큰 경우**에 맞춰 자리를 잡아 두고 안쪽에서 가운데 정렬합니다.
          `min-h-24`(96px) 는 눈대중이 아니라 가장 큰 조합을 더한 값입니다 —
          안내문 20 + 간격 8 + 버튼 md 44 + 간격 8 + 남은시간 16.
          🔴 **버튼 크기나 줄 수를 바꾸면 이 값도 같이 고치세요.** 안 고치면 그 경우만
             상자를 밀어내서, 고정해 둔 의미가 그대로 사라집니다. */}
      <div className="flex min-h-24 flex-col justify-center gap-2">
        {myTurn ? (
          state.canThrow ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={pending}
              onClick={() => onAction({ action: 'THROW' })}
            >
              윷 던지기
            </Button>
          ) : (
            <>
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
            </>
          )
        ) : (
          <p className="text-muted text-center text-sm">
            <span className={seatColor(state.turn).text}>
              {room.participants.find((p) => p.seatNo === state.turn)?.nickname ?? `${state.turn + 1}번`}
            </span>
            님의 차례예요
          </p>
        )}

        {/* 남은 시간 — 서버가 준 기한을 그대로 셉니다. 예전에는 아무 예고 없이 10초 뒤
            서버가 대신 던져서 "왜 내 말이 움직였지?" 가 됐습니다 */}
        <TurnCountdown expiresAt={room.turnExpiresAt} mine={myTurn} />
      </div>

      {chat}
    </div>
  );
}

/**
 * 이번 차례에 남은 시간.
 *
 * 🔴 **예고 없이 서버가 대신 두는 것을 막으려고 있습니다.** 던지기는 10초, 말 옮기기는
 * 60초인데 화면에 아무 표시가 없으면 "왜 내 말이 저절로 움직였지?" 가 됩니다.
 *
 * 🔴 숫자를 직접 깎지 않고 `useCountdown` 이 매번 남은 시간을 다시 잽니다 — 탭이
 * 백그라운드로 가면 타이머가 느려져서 화면만 여유 있게 보입니다 (그 훅 주석).
 *
 * 자리는 늘 차지하고 있습니다. 10초 이하에서만 글자가 뜨면 그때마다 줄이 생겼다
 * 사라져서, 이 패널이 고정 높이를 쓰는 이유가 그대로 무너집니다.
 */
function TurnCountdown({ expiresAt, mine }: { expiresAt: string | null; mine: boolean }) {
  const deadline = expiresAt ? parseServerTime(expiresAt) : null;
  const left = useCountdown(deadline);

  return (
    <p className="text-subtle h-4 text-center text-xs tabular-nums">
      {deadline && left > 0
        ? mine
          ? `${left}초 안에 안 하면 자동으로 진행돼요`
          : `${left}초`
        : ''}
    </p>
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
  const [flash, setFlash] = useState<{ result: number; seat: number; seq: number } | null>(null);
  const seen = useRef<number | null>(null);

  useEffect(() => {
    if (result === null || seat === null || seq === 0) return;
    if (seen.current === seq) return;
    seen.current = seq;

    setFlash({ result, seat, seq });
    const timer = setTimeout(() => setFlash(null), THROW_FLASH_MS);
    return () => clearTimeout(timer);
  }, [result, seat, seq]);

  return flash;
}
