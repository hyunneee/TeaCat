import { YUT_CELLS, YUT_GOAL_CELL, YUT_GRID, seatColor } from '../model/yutBoard';
import type { YutState } from '../model/game.types';

interface Props {
  state: YutState;
  /** 고른 말을 강조합니다. 고르기 전이면 null */
  selectedPiece: number | null;
  mySeatNo: number;
  onPickPiece?: (pieceIndex: number) => void;
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
 */
export function YutBoardView({ state, selectedPiece, mySeatNo, onPickPiece }: Props) {
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

  const cells = [...YUT_CELLS.map((cell, index) => ({ cell, index })), { cell: YUT_GOAL_CELL, index: 28 }];

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
        const isGoal = index === 28;
        return (
          <div
            key={index}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: pos(cell.x), top: pos(cell.y) }}
          >
            <div
              className={[
                'surface-1 border-border flex items-center justify-center rounded-full border',
                cell.big ? 'size-9' : 'size-6',
              ].join(' ')}
            >
              {isGoal && <span className="text-muted text-[9px] font-bold">도착</span>}
            </div>

            {/* 이 밭에 선 말들 */}
            <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-0.5">
              {here.map(({ seat, pieces }) => {
                const color = seatColor(seat);
                const picked = seat === mySeatNo && selectedPiece !== null && pieces.includes(selectedPiece);
                return (
                  <button
                    key={seat}
                    type="button"
                    disabled={seat !== mySeatNo || !onPickPiece}
                    onClick={() => {
                      const first = pieces[0];
                      if (first !== undefined) onPickPiece?.(first);
                    }}
                    className={[
                      'flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow',
                      color.chip,
                      picked ? `ring-2 ${color.ring}` : '',
                      seat === mySeatNo && onPickPiece ? 'cursor-pointer' : 'cursor-default',
                    ].join(' ')}
                    aria-label={`${seat + 1}번 자리 말 ${pieces.length}개`}
                  >
                    {pieces.length > 1 ? pieces.length : ''}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
