import { Flag } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/shared/lib';
import { YUT_CELLS, YUT_GOAL, YUT_GOAL_CELL, YUT_GRID, seatColor } from '../model/yutBoard';
import { pieceStyleOf } from '../model/yutPieces';
import type { GameParticipant, YutState } from '../model/game.types';

interface Props {
  state: YutState;
  participants: GameParticipant[];
  /** 지금 이 결과로 갈 수 있는 자리들. 비어 있으면 표시하지 않습니다 */
  destinations: Destination[];
  onPickPiece?: (pieceIndex: number) => void;
}

/** "이 말을 쓰면 여기로 갑니다" 한 쌍 */
export interface Destination {
  pieceIndex: number;
  to: number;
}

/** 격자 좌표(0~5)를 백분율로. 가장자리 말이 잘리지 않게 안쪽으로 조금 당깁니다 */
function pos(value: number) {
  const inset = 7;
  return `${inset + (value / YUT_GRID) * (100 - inset * 2)}%`;
}

/**
 * 윷판.
 *
 * <p>밭마다 지금 서 있는 말을 겹쳐 그립니다. 같은 밭에 여러 개면 업은 것이라 개수를
 * 숫자로 보여줍니다 — 동그라미를 겹쳐 그리면 몇 개인지 셀 수 없습니다.
 *
 * <p>🔴 <b>이동할 자리를 미리 보여줍니다</b>(`destinations`). 윷판은 지름길 때문에
 * "걸이면 어디까지 가는지" 가 눈으로 계산되지 않습니다 — 모서리에 <b>정확히 멈춰야</b>
 * 지름길을 타는데, 판만 봐서는 지금 말이 그 모서리에 설지 알 수 없습니다. 도착 자리에
 * 테두리를 띄우고 눌러서 그리로 보냅니다.
 *
 * <p>말 모양은 사람마다 다릅니다(`pieceStyleOf`). 색만으로는 지름 20px 동그라미 넷이
 * 구분되지 않아서입니다.
 */
export function YutBoardView({ state, participants, destinations, onPickPiece }: Props) {
  const reduce = useReducedMotion();

  /** 밭 번호 → 거기 선 말들 */
  const occupants = new Map<number, { seat: number; pieces: number[] }[]>();
  state.pieces.forEach((mine, seat) => {
    mine.forEach((position, pieceIndex) => {
      if (position < 0) return;
      const here = occupants.get(position) ?? [];
      const found = here.find((entry) => entry.seat === seat);
      if (found) found.pieces.push(pieceIndex);
      else here.push({ seat, pieces: [pieceIndex] });
      occupants.set(position, here);
    });
  });

  /** 밭 번호 → 그리로 보낼 수 있는 내 말 */
  const landing = new Map<number, number>();
  destinations.forEach(({ pieceIndex, to }) => {
    if (!landing.has(to)) landing.set(to, pieceIndex);
  });

  const styleOf = (seat: number) =>
    pieceStyleOf(participants.find((p) => p.seatNo === seat)?.pieceStyle);

  const cells = [
    ...YUT_CELLS.map((cell, index) => ({ cell, index })),
    { cell: YUT_GOAL_CELL, index: YUT_GOAL },
  ];

  return (
    <div className="surface-2 relative mx-auto aspect-square w-full max-w-[22rem] rounded-2xl">
      {/* 지름길 두 줄. 밭보다 먼저 그려 뒤로 깔립니다 */}
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" aria-hidden>
        <line x1="93" y1="7" x2="7" y2="93" stroke="currentColor" strokeWidth="0.6" className="text-border" />
        <line x1="7" y1="7" x2="93" y2="93" stroke="currentColor" strokeWidth="0.6" className="text-border" />
        <rect x="7" y="7" width="86" height="86" fill="none" stroke="currentColor" strokeWidth="0.6" className="text-border" />
      </svg>

      {cells.map(({ cell, index }) => {
        const here = occupants.get(index) ?? [];
        const isGoal = index === YUT_GOAL;
        const target = landing.get(index);

        return (
          <div
            key={index}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: pos(cell.x), top: pos(cell.y) }}
          >
            <div
              className={cn(
                'surface-1 border-border flex items-center justify-center rounded-full border',
                cell.big ? 'size-9' : 'size-6',
              )}
            >
              {isGoal && <Flag size={12} className="text-muted" aria-hidden />}
            </div>

            {/* 갈 수 있는 자리 — 눌러서 그리로 보냅니다 */}
            {target !== undefined && onPickPiece && (
              <motion.button
                type="button"
                onClick={() => onPickPiece(target)}
                animate={reduce ? undefined : { scale: [1, 1.12, 1] }}
                transition={{ duration: 1.1, repeat: Infinity }}
                className={cn(
                  /* 초록은 "지금 눌러야 할 것" 자리입니다(DESIGN.md 1장). brand 는 채도 0 이라
                     밭 테두리와 구분되지 않습니다 */
                  'ring-accent-600 bg-accent-500/20 absolute inset-0 m-auto rounded-full ring-2',
                  cell.big ? 'size-10' : 'size-7',
                )}
                aria-label={isGoal ? '여기로 보내서 완주하기' : '여기로 보내기'}
              />
            )}

            {/* 이 밭에 선 말들 */}
            <div className="pointer-events-none absolute inset-0 flex flex-wrap items-center justify-center gap-0.5">
              {here.map(({ seat, pieces }) => {
                const color = seatColor(seat);
                const Icon = styleOf(seat).icon;
                return (
                  <span
                    key={seat}
                    className={cn(
                      'relative flex size-5 items-center justify-center rounded-full text-white shadow',
                      color.chip,
                    )}
                    aria-label={`${seat + 1}번 자리 말 ${pieces.length}개`}
                  >
                    <Icon size={12} strokeWidth={2.6} aria-hidden />
                    {/* 업은 말 개수. 겹쳐 그리면 셀 수 없어서 숫자로 답니다 */}
                    {pieces.length > 1 && (
                      <span className="text-ink absolute -right-1 -top-1 flex size-3 items-center justify-center rounded-full bg-white text-[8px] font-black shadow">
                        {pieces.length}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
