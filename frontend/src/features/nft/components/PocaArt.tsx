import { cn } from '@/shared/lib';
import type { Rarity } from '../model/nft.types';

function hashOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

interface Props {
  seed: string;
  rarity: Rarity;
  imageUrl?: string | null;
  alt: string;
  className?: string;
}

/* 등급이 높을수록 테두리가 뚜렷해집니다 — 목록에서 바로 구분됩니다.
   빛나는 애니메이션 대신 정지된 테두리로 구분합니다. 목록에 12장이 깔렸을 때
   전부 반짝이면 무엇이 특별한지 알 수 없습니다. */
const RING: Record<Rarity, string> = {
  NORMAL: 'ring-1 ring-white/10',
  RARE: 'ring-2 ring-rarity-rare/60',
  SPECIAL: 'ring-2 ring-rarity-special',
};

/**
 * 포토카드 아트.
 *
 * 실제 이미지가 없어서 시드 기반으로 SVG 를 생성합니다.
 * (외부 이미지 서비스를 쓰면 오프라인에서 깨지고 PWA 캐시가 지저분해집니다)
 * 진짜 아트가 생기면 `imageUrl` 만 넘기면 됩니다.
 */
export function PocaArt({ seed, rarity, imageUrl, alt, className }: Props) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        className={cn('aspect-[2/3] w-full rounded-lg object-cover', RING[rarity], className)}
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
      className={cn(
        'relative aspect-[2/3] w-full overflow-hidden rounded-lg',
        RING[rarity],
        className,
      )}
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

      {/* SPECIAL 은 정지된 홀로그램 결 */}
      {rarity === 'SPECIAL' && (
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(115deg,transparent_38%,rgba(255,255,255,0.16)_50%,transparent_62%)]"
        />
      )}
    </div>
  );
}
