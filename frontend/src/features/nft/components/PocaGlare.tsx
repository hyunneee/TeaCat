import { motion, useTransform, type MotionValue } from 'motion/react';
import { cn } from '@/shared/lib';

interface Props {
  /** 빛의 가로 위치 0~1 (useGlareSweep) */
  glare: MotionValue<number>;
  /** 빛의 세기 0~1 (useGlareSweep) */
  intensity: MotionValue<number>;
  /** 카드 모서리에 맞추세요 — 빛이 모서리 밖으로 새면 종이가 아니라 사각형으로 보입니다 */
  radiusClass?: string;
}

/** 세로 막대를 시계방향으로 눕혀 `/` 방향을 만듭니다. */
const BAND_ANGLE = 24;

/**
 * 카드 위에 얹는 **빛 반사 레이어** — 순수 View.
 *
 * 언제 빛나는지는 `useGlareSweep` 이 정합니다. 여기는 그리기만 합니다.
 * 부모에 `relative` 와 카드 크기가 있어야 합니다.
 */
export function PocaGlare({ glare, intensity, radiusClass = 'rounded-lg' }: Props) {
  const bandX = useTransform(glare, [0, 1], ['-170%', '170%']);
  const sheen = useTransform(intensity, [0, 1], [0, 0.26]);

  return (
    <>
      {/* 빛 띠 — 카드 밖으로 새지 않게 잘라냅니다 */}
      <motion.span
        aria-hidden
        style={{ opacity: intensity }}
        className={cn('pointer-events-none absolute inset-0 overflow-hidden', radiusClass)}
      >
        <motion.span
          style={{ x: bandX, rotate: BAND_ANGLE }}
          className={cn(
            'absolute top-[-40%] bottom-[-40%] left-1/2 w-[46%] -translate-x-1/2',
            'bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10)_28%,rgba(255,255,255,0.62)_50%,rgba(255,255,255,0.10)_72%,transparent)]',
          )}
        />
      </motion.span>

      {/* 표면 유광 — 빛이 지나갈 때만 살짝 밝아집니다 */}
      <motion.span
        aria-hidden
        style={{ opacity: sheen }}
        className={cn(
          'pointer-events-none absolute inset-0',
          radiusClass,
          'bg-[linear-gradient(135deg,rgba(255,255,255,0.5),transparent_45%)]',
        )}
      />
    </>
  );
}
