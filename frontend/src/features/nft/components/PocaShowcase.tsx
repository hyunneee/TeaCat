import { useCallback, useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { cn, EASE } from '@/shared/lib';
import { PocaArt } from './PocaArt';
import type { Rarity } from '../model/nft.types';

interface Props {
  seed: string;
  rarity: Rarity;
  imageUrl?: string | null;
  alt: string;
  className?: string;
  /** 카드를 눌렀을 때 — 보통 전체화면 보기를 엽니다 */
  onOpen?: () => void;
}

/**
 * 상세 화면의 포토카드 한 장 — **빛 반사** 연출.
 *
 * 새 카드 표면에 사선(`/`)으로 빛이 한 번 스쳐 지나갑니다. **들어왔을 때 한 번만.**
 * 누르는 동작은 반짝임이 아니라 **전체화면 보기**에 씁니다 —
 * 카드를 누르는 사람은 다시 반짝이길 원하는 게 아니라 크게 보고 싶은 겁니다.
 *
 * ── 목록에는 쓰지 않습니다 ─────────────────────────────────
 * 카드 12장이 전부 반짝이면 아무것도 특별해 보이지 않고, 무한 루프 반짝임은
 * 전형적인 "AI 가 만든 티" 입니다. (DESIGN.md 8장)
 * 이 연출은 **상세 화면의 한 장**, **한 번씩만** 입니다.
 */

/** 세로 막대를 시계방향으로 눕혀 `/` 방향을 만듭니다. */
const BAND_ANGLE = 24;
const SWEEP_SECONDS = 1.05;

export function PocaShowcase({ seed, rarity, imageUrl, alt, className, onOpen }: Props) {
  const reduced = useReducedMotion() ?? false;

  /** 빛의 가로 위치 (0 = 왼쪽 밖, 1 = 오른쪽 밖) */
  const glare = useMotionValue(0);
  /** 빛의 세기 (0~1) */
  const intensity = useMotionValue(0);

  const bandX = useTransform(glare, [0, 1], ['-170%', '170%']);
  const sheen = useTransform(intensity, [0, 1], [0, 0.26]);

  /** 표면을 한 번 훑습니다 */
  const sweep = useCallback(() => {
    if (reduced) return;
    glare.set(0);
    intensity.set(0);
    animate(glare, 1, { duration: SWEEP_SECONDS, ease: EASE.out });
    animate(intensity, [0, 1, 1, 0], { duration: SWEEP_SECONDS, times: [0, 0.16, 0.6, 1] });
  }, [glare, intensity, reduced]);

  useEffect(() => {
    // 화면에 자리를 잡은 뒤에 시작해야 "지금 막 도착한 카드" 로 읽힙니다.
    const timer = setTimeout(sweep, 260);
    return () => clearTimeout(timer);
  }, [sweep]);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${alt} — 눌러서 크게 보기`}
      className={cn('relative block rounded-lg', className)}
    >
      <PocaArt seed={seed} rarity={rarity} imageUrl={imageUrl} alt={alt} />

      {/* 빛 띠 — 카드 밖으로 새지 않게 잘라냅니다 */}
      <motion.span
        aria-hidden
        style={{ opacity: intensity }}
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
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
        className="pointer-events-none absolute inset-0 rounded-lg bg-[linear-gradient(135deg,rgba(255,255,255,0.5),transparent_45%)]"
      />
    </button>
  );
}
