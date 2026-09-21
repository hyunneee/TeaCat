import { motion } from 'motion/react';
import { useReducedMotion } from '@/shared/hooks';
import { DURATION, EASE } from '@/shared/lib';
import { PIECE_LABEL, type Piece } from '../model/songpyeonGame.model';
import { SongpyeonPiece } from './SongpyeonPiece';

interface Props {
  pieces: Piece[];
  /** 끝난 판에서는 더 받지 않습니다. 조각은 그대로 두고 누르는 것만 막습니다 */
  locked: boolean;
  onCatch: (pieceId: number) => void;
}

/**
 * 송편이 떴다 사라지는 판.
 *
 * 자리는 부모 크기에 대한 **비율(%)** 입니다. 픽셀로 잡으면 화면 폭에 따라 조각이 한쪽으로
 * 몰리거나 밖으로 나갑니다 — 판은 화면을 꽉 쓰는 자리라 높이도 기기마다 다릅니다.
 *
 * 🔴 **사라질 때 연출을 넣지 않습니다.** 사라지는 중인 조각이 화면에 남아 있으면 그걸 누르게
 * 되고, 규칙상 그건 이미 없는 조각이라 아무 일도 안 일어납니다 — 사용자에게는 "눌렀는데
 * 먹통" 입니다. 나타날 때만 살짝 커지며 등장합니다.
 */
export function SongpyeonBoard({ pieces, locked, onCatch }: Props) {
  const reduced = useReducedMotion();

  return (
    <div className="relative size-full overflow-hidden rounded-2xl bg-white/6">
      {pieces.map((piece) => (
        <motion.button
          key={piece.id}
          type="button"
          disabled={locked}
          onClick={() => onCatch(piece.id)}
          /* 터치 타겟 44px (CLAUDE.md 4-4). 그림은 그보다 작아도 누를 자리는 넉넉해야
             합니다 — 5단계에서 0.5초 안에 정확히 찍을 수는 없습니다 */
          className="absolute flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-100"
          style={{ left: `${piece.xPct}%`, top: `${piece.yPct}%` }}
          initial={reduced ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: DURATION.quick, ease: EASE.back }}
          aria-label={PIECE_LABEL[piece.kind]}
        >
          <SongpyeonPiece kind={piece.kind} />
        </motion.button>
      ))}
    </div>
  );
}
