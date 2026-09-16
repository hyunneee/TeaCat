import { memo } from 'react';
import { motion } from 'motion/react';
import { PawPrint } from 'lucide-react';
import { PocaArt } from '@/features/nft';
import { cn, DURATION, EASE } from '@/shared/lib';
import type { MemoryCard as Card } from '../model/memoryGame.model';

interface Props {
  card: Card;
  /** 그림이 보이는가 (지금 뒤집었거나, 이미 맞춘 짝이거나) */
  faceUp: boolean;
  /** 짝을 맞춰 끝난 카드 */
  matched: boolean;
  /** 방금 빗나간 두 장 중 하나 — 흔들립니다 */
  missed: boolean;
  disabled: boolean;
  reduced: boolean;
  onFlip: (cardId: number) => void;
}

/* 회전은 카드가 넘어가는 느낌이 나야 해서 기본 duration 보다 깁니다.
   대신 **transform 만** 움직여 합성(compositor) 단계에서 끝납니다 — 레이아웃이 없습니다. */
const FLIP_SECONDS = 0.44;

/**
 * 카드 한 장.
 *
 * ── 🔴 왜 CSS transform 인가 ─────────────────────────────────
 * 뒤집기 자체는 `motion` 이 아니라 CSS transition 입니다. 16장이 동시에 움직일 수
 * 있고, 회전은 **transform 하나**라 브라우저가 메인 스레드 없이 처리합니다.
 * motion 으로 하면 매 프레임 자바스크립트가 16번 값을 써넣습니다.
 * motion 은 "빗나감" 흔들림처럼 **두 장에만, 한 번** 도는 연출에만 씁니다.
 *
 * ⚠️ 앞뒤 두 면을 겹쳐 놓고 안쪽 상자만 돌립니다. `backface-visibility: hidden`
 * 이 없으면 뒷면의 글씨가 거울처럼 비쳐 보입니다. (`PocaFace` 와 같은 방식)
 */
export const MemoryCard = memo(function MemoryCard({
  card,
  faceUp,
  matched,
  missed,
  disabled,
  reduced,
  onFlip,
}: Props) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => onFlip(card.id)}
      aria-label={faceUp ? '뒤집힌 카드' : '카드 뒤집기'}
      /* 흔들림은 빗나간 두 장에만 겁니다. 나머지 14장은 x: 0 이라 아무 일도 없습니다.
         "동작 줄이기" 면 흔들지 않습니다 — 대신 아래 붉은 테두리가 남습니다(기능 유지). */
      animate={{ x: missed && !reduced ? [0, -7, 7, -5, 5, 0] : 0 }}
      transition={{ duration: DURATION.slow, ease: EASE.out }}
      className={cn(
        /* 크기는 격자 칸이 정합니다 — 칸을 꽉 채웁니다 (MemoryBoard 의 grid-rows-4) */
        'relative size-full [perspective:900px]',
        'rounded-xl transition-opacity duration-200',
        'focus-visible:outline-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2',
        // 맞춘 카드는 살짝 물러나 "끝난 것" 으로 읽히게 합니다 (숨기면 무엇을 맞췄는지 못 봅니다)
        matched && 'opacity-55',
        !disabled && 'cursor-pointer',
      )}
    >
      <div
        className={cn(
          'relative size-full [transform-style:preserve-3d]',
          // 맞은 순간 한 번 커졌다 돌아오는 대신, 그냥 살짝 커진 채로 둡니다 — 반복 애니메이션은 소음입니다
          matched && 'scale-[0.94]',
        )}
        style={{
          transform: faceUp ? 'rotateY(180deg)' : undefined,
          transition: reduced
            ? 'none'
            : `transform ${FLIP_SECONDS}s cubic-bezier(${EASE.out.join(',')})`,
        }}
      >
        {/* 뒷면 — 엎어 놓은 상태 */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl',
            'bg-brand-900 [backface-visibility:hidden]',
            missed && !matched && 'ring-danger ring-2',
          )}
        >
          <PawPrint size={22} className="text-brand-600" aria-hidden />
          {/* 사선 광택 한 줄 — 엎은 면이 종이가 아니라 카드로 보이게 합니다 */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-y-4 -left-1/3 w-1/2 rotate-[25deg] bg-white/10"
          />
        </div>

        {/* 앞면 — 180° 돌려 놓고, 위 상자가 돌면 이쪽이 보입니다 */}
        <div
          className={cn(
            'absolute inset-0 overflow-hidden rounded-xl [backface-visibility:hidden]',
            missed && 'ring-danger ring-2',
            matched && 'ring-accent-700 ring-2',
          )}
          style={{ transform: 'rotateY(180deg)' }}
        >
          <PocaArt
            seed={card.seed}
            alt="포토카드 그림"
            className="aspect-auto size-full rounded-xl"
          />
        </div>
      </div>
    </motion.button>
  );
});
