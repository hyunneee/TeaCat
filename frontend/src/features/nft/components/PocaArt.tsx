import { cn } from '@/shared/lib';

function hashOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

interface Props {
  seed: string;
  imageUrl?: string | null;
  alt: string;
  className?: string;
}

/**
 * 포토카드 아트.
 *
 * 실제 이미지가 없어서 시드 기반으로 SVG 를 생성합니다.
 * (외부 이미지 서비스를 쓰면 오프라인에서 깨지고 PWA 캐시가 지저분해집니다)
 * 진짜 아트가 생기면 `imageUrl` 만 넘기면 됩니다.
 */
export function PocaArt({ seed, imageUrl, alt, className }: Props) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        className={cn('aspect-[2/3] w-full rounded-lg object-cover', className)}
      />
    );
  }

  const h = hashOf(seed);
  const hue = h % 360;
  const blobs = [0, 1, 2].map((i) => ({
    cx: 20 + ((h >> (i * 3)) % 60),
    cy: 20 + ((h >> (i * 5)) % 60),
    r: 18 + ((h >> (i * 7)) % 22),
    hue: (hue + i * 55) % 360,
  }));

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn('relative aspect-[2/3] w-full overflow-hidden rounded-lg', className)}
    >
      <svg viewBox="0 0 100 150" preserveAspectRatio="xMidYMid slice" className="size-full">
        <rect width="100" height="150" fill={`oklch(0.24 0.06 ${hue})`} />
        {blobs.map((blob, i) => (
          <circle
            key={i}
            cx={blob.cx}
            cy={blob.cy * 1.5}
            r={blob.r}
            fill={`oklch(0.6 0.15 ${blob.hue})`}
            opacity={0.6}
          />
        ))}
      </svg>
    </div>
  );
}
