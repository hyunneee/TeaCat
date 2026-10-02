import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ConciergeBell } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import { COMPASS_CELL, compassOf } from '../model/halliGalliTable';
import { seatColor } from '../model/yutBoard';
import type { GameParticipant, GameRoom, HalliGalliState } from '../model/game.types';
import { FruitCard } from './FruitCard';

interface Props {
  room: GameRoom;
  state: HalliGalliState;
  onAction: (body: { action: 'FLIP' | 'BELL' }) => void;
  pending: boolean;
  /** 기록 대신 들어가는 채팅 창. 페이지가 만들어 내려줍니다 */
  chat: ReactNode;
}

/** 종이 울린 자국이 화면에 머무는 시간 */
const BELL_FLASH_MS = 1100;

/**
 * 할리갈리 한 판.
 *
 * <p>자리는 **동서남북**입니다. 내가 언제나 남(아래)이고 나머지는 차례 순서대로
 * 시계방향(남 → 서 → 북 → 동)으로 앉습니다 — 누가 다음인지 화면만 봐도 알 수 있어야 합니다.
 * 카드를 뒤집으면 그 사람 자리에 카드가 놓이고, 가운데가 종입니다.
 *
 * <p>🔴 <b>종을 칠 수 있는지 화면이 판단하지 않습니다.</b> 보이는 카드로 계산해서 버튼을
 * 잠그면 그게 곧 정답 표시가 되어, 눈으로 세는 게임이 아니라 버튼이 켜지길 기다리는
 * 게임이 됩니다. 맞았는지는 서버가 정합니다. 버튼을 잠그는 경우는 하나뿐입니다 —
 * 손패도 펼친 카드도 없어서 <b>규칙상 칠 수 없을 때</b>입니다.
 */
export function HalliGalliPanel({ room, state, onAction, pending, chat }: Props) {
  const myTurn = state.turn === room.mySeatNo;
  const alive = !state.eliminated[room.mySeatNo];
  /* 손패가 비어도 펼쳐 둔 카드가 남아 있으면 칠 수 있습니다. 되찾아 올 카드가 있으니까요.
     (서버의 HalliGalliState.canRing 과 같은 규칙입니다) */
  const myCards = (state.handCounts[room.mySeatNo] ?? 0) + (state.piles[room.mySeatNo]?.length ?? 0);
  const canRing = alive && myCards > 0;
  const canFlip = myTurn && alive && (state.handCounts[room.mySeatNo] ?? 0) > 0;

  const bell = useBellFlash(state.lastBellSeat, state.lastBellCorrect, state.bellSeq);
  const reduce = useReducedMotion();
  useBellHotkey(canRing, onAction);

  const ringer = room.participants.find((p) => p.seatNo === bell?.seat);

  return (
    <div className="space-y-4">
      {/* ── 탁자 ── 3×3 격자. 가운데가 종, 나머지 네 칸이 자리.

          🔴 **정사각형을 쓰지 않습니다.** `aspect-square w-full` 이면 앱 폭(480px) 가까이
             정사각형이 되는데, 안에 든 것은 72px 짜리 카드 넷과 56px 종 하나가 전부라
             탁자의 절반이 빈 칸이었습니다. 그만큼 아래의 버튼·채팅이 화면 밖으로 밀려서
             종을 치려면 스크롤부터 해야 했습니다.

             대신 **내용이 요구하는 만큼만** 높이를 잡고(`aspect-[5/4]` + 상한), 폭도
             묶어서 가운데 둡니다 — 윷판이 `max-w-[22rem]` 로 하는 것과 같은 방식입니다. */}
      <div className="surface-2 relative mx-auto grid aspect-[5/4] w-full max-w-[20rem] grid-cols-3 grid-rows-3 gap-2 rounded-2xl p-2">
        {room.participants.map((participant) => (
          <PlayerSeat
            key={participant.seatNo}
            participant={participant}
            state={state}
            mySeatNo={room.mySeatNo}
            players={room.participants.length}
          />
        ))}

        {/* 가운데 종 — 탁상종(누르는 종)입니다. 손잡이를 흔드는 종보다 "손바닥으로
            내리치는" 이 게임의 동작에 가깝고, 위에서 눌린다는 것이 그림으로 읽힙니다 */}
        <div className="col-start-2 row-start-2 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* 종소리 — 퍼져 나가는 물결. 🔴 누가 쳤든 방에 있는 모두가 봅니다.
                서버가 bellSeq 를 올려 주므로 같은 사람이 연달아 쳐도 매번 새로 돕니다 */}
            {bell && !reduce && (
              <>
                {[0, 1].map((ring) => (
                  <motion.span
                    key={`${bell.seq}-${ring}`}
                    initial={{ scale: 0.6, opacity: 0.55 }}
                    animate={{ scale: 2.6, opacity: 0 }}
                    transition={{ duration: 0.9, delay: ring * 0.18, ease: 'easeOut' }}
                    className={cn(
                      'absolute size-14 rounded-full border-2',
                      bell.correct ? 'border-emerald-500' : 'border-rose-500',
                    )}
                  />
                ))}
              </>
            )}

            <motion.div
              animate={
                bell && !reduce
                  ? { y: [0, 5, -2, 0], scale: [1, 0.92, 1.08, 1] }
                  : { y: 0, scale: 1 }
              }
              transition={{ duration: 0.5 }}
              className={cn(
                'relative flex size-14 items-center justify-center rounded-full transition-colors',
                bell?.correct === true && 'bg-emerald-100 text-emerald-600',
                bell?.correct === false && 'bg-rose-100 text-rose-600',
                !bell && 'surface text-ink-subtle',
              )}
            >
              <ConciergeBell size={30} strokeWidth={2} aria-hidden />
            </motion.div>
          </div>
        </div>

        {/* 종이 울린 직후에만 뜨는 한 줄. 자리 위에 겹쳐 놓아 시선이 가운데에 머뭅니다 */}
        {bell && (
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full px-3 py-1 text-xs font-bold shadow',
              bell.correct ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white',
            )}
          >
            {ringer?.nickname ?? ''} · {bell.correct ? '성공! 카드를 가져갔어요' : '실패! 한 장씩 물어줬어요'}
          </motion.p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          disabled={!canFlip}
          loading={pending && myTurn}
          onClick={() => onAction({ action: 'FLIP' })}
        >
          {myTurn ? '카드 뒤집기' : '내 차례 아님'}
        </Button>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canRing}
          onClick={() => onAction({ action: 'BELL' })}
        >
          종 치기
        </Button>
      </div>

      <p className="text-muted text-center text-xs">
        보이는 카드 중 같은 과일이 <b>정확히 5개</b>일 때 종을 치세요. 틀리면 한 장씩 물어줍니다.
        <br />
        <span className="hidden sm:inline">
          키보드에서는 <b>스페이스바</b>로도 칠 수 있어요.
        </span>
      </p>

      {chat}
    </div>
  );
}

/** 한 사람의 자리 — 이름, 남은 장수, 지금 펼쳐 놓은 카드 */
function PlayerSeat({
  participant,
  state,
  mySeatNo,
  players,
}: {
  participant: GameParticipant;
  state: HalliGalliState;
  mySeatNo: number;
  players: number;
}) {
  const seat = participant.seatNo;
  const compass = compassOf(seat, mySeatNo, players);
  const top = state.piles[seat]?.[0];
  const out = state.eliminated[seat];
  const color = seatColor(seat);
  const turn = state.turn === seat && !out;

  return (
    <div
      className={cn(
        COMPASS_CELL[compass],
        'flex flex-col items-center justify-center gap-1 rounded-xl p-1 transition',
        /* 지금 차례인 자리만 테두리로 띄웁니다 — 누가 뒤집을 순서인지가 제일 중요합니다 */
        turn && `ring-2 ${color.ring}`,
        out && 'opacity-40',
      )}
    >
      <div className="flex w-full items-center justify-center gap-1">
        <span className={cn('size-2 shrink-0 rounded-full', color.chip)} aria-hidden />
        <span className="min-w-0 truncate text-[11px] font-bold">
          {participant.me ? '나' : participant.nickname}
        </span>
        <span className="text-subtle shrink-0 text-[10px] tabular-nums">
          {state.handCounts[seat] ?? 0}
        </span>
      </div>

      <FruitCard
        card={top}
        emptyLabel={out ? '탈락' : '—'}
        className="h-[4.5rem] w-full max-w-[6.5rem]"
      />
    </div>
  );
}

/**
 * 스페이스바(와 엔터)로도 종을 칩니다.
 *
 * 데스크톱에서 화면을 짚는 것보다 훨씬 빠르고, 이 게임은 **누가 먼저인가**가 곧 승부라
 * 입력 수단이 느리면 규칙이 아니라 기기가 이깁니다.
 *
 * 🔴 자동 반복(`event.repeat`)을 막습니다. 누르고 있으면 초당 수십 번 발사되는데, 종은
 * 틀리면 카드를 물어주는 행동이라 한 번의 실수가 손패를 통째로 날립니다.
 *
 * 🔴 `preventDefault` 가 두 가지를 동시에 막습니다 — 스페이스의 기본 동작인 **스크롤**,
 * 그리고 버튼에 포커스가 있을 때 브라우저가 만들어내는 **클릭**(없으면 종이 두 번 울립니다).
 */
function useBellHotkey(enabled: boolean, onAction: (body: { action: 'BELL' }) => void) {
  const actionRef = useRef(onAction);
  actionRef.current = onAction;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      if (event.repeat) return;

      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      if (typing) return;

      event.preventDefault();
      actionRef.current({ action: 'BELL' });
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

/**
 * 방금 종이 울렸나.
 *
 * <p>서버 상태에는 "마지막 종" 만 남아 있어서, 그 값만 보면 <b>한 번 울린 뒤 계속</b>
 * 울린 것처럼 보입니다. 그래서 `bellSeq` 가 <b>바뀐 순간</b>에만 잠깐 켜고 스스로 끕니다 —
 * 같은 사람이 같은 결과로 연달아 쳐도 번호가 오르므로 새 종으로 알아봅니다.
 */
function useBellFlash(seat: number | null, correct: boolean | null, seq: number) {
  const [flash, setFlash] = useState<{ seat: number; correct: boolean; seq: number } | null>(null);
  const seen = useRef<number | null>(null);

  useEffect(() => {
    if (seat === null || correct === null || seq === 0) return;
    if (seen.current === seq) return;
    seen.current = seq;

    setFlash({ seat, correct, seq });
    const timer = setTimeout(() => setFlash(null), BELL_FLASH_MS);
    return () => clearTimeout(timer);
  }, [seat, correct, seq]);

  return flash;
}
