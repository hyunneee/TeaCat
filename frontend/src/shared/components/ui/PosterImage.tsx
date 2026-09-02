import { cn } from '@/shared/lib';

/** 문자열 → 0~359 (같은 시드는 항상 같은 색) */
function hue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export interface PosterImageProps {
  /** 진짜 포스터 URL. 없으면 시드 기반 그라데이션을 그립니다. */
  src?: string | null;
  seed: string;
  alt: string;
  /** 그라데이션 위에 얹을 글자 */
  caption?: string;
  className?: string;
  ratio?: 'poster' | 'square' | 'wide';
}

const RATIO = {
  poster: 'aspect-[3/4]',
  square: 'aspect-square',
  wide: 'aspect-[16/9]',
} as const;

/**
 * 포스터/포토카드 이미지.
 *
 * 백엔드가 아직 없어서 실제 이미지 URL 이 없습니다.
 * 외부 플레이스홀더 서비스를 쓰면 오프라인에서 깨지고 PWA 캐시도 지저분해지므로,
 * 시드값으로 CSS 그라데이션을 그려 대체합니다. 같은 공연은 항상 같은 색이 나옵니다.
 * 진짜 이미지가 생기면 `src` 만 넘기면 됩니다.
 */
export function PosterImage({
  src,
  seed,
  alt,
  caption,
  className,
  ratio = 'poster',
}: PosterImageProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        draggable={false}
        className={cn('border-line w-full rounded-xl border object-cover', RATIO[ratio], className)}
      />
    );
  }

  const h = hue(seed);

  return (
    <div
      role="img"
      aria-label={alt}
      style={{
        backgroundImage: `linear-gradient(150deg,
          oklch(0.52 0.2 ${h}) 0%,
          oklch(0.36 0.17 ${(h + 45) % 360}) 55%,
          oklch(0.2 0.09 ${(h + 80) % 360}) 100%)`,
      }}
      className={cn(
        'relative flex w-full items-end overflow-hidden rounded-xl',
        'ring-1 ring-white/10',
        RATIO[ratio],
        className,
      )}
    >
      {/* 은은한 광택 */}
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_25%_12%,rgba(255,255,255,0.3),transparent_58%)]"
      />
      {/* 아래쪽을 어둡게 해서 글자가 읽히게 */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55" />

      {caption && (
        <span className="relative z-10 w-full truncate p-2.5 text-xs font-bold text-white/95">
          {caption}
        </span>
      )}
    </div>
  );
}
