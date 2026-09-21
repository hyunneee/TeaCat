import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/shared/components/ui';
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
 * 몇 번까지 다시 받아 볼지.
 *
 * 🔴 **한 번 실패하면 `<img>` 는 스스로 다시 시도하지 않습니다.** 그림은 공용 IPFS
 * 게이트웨이(`gateway.pinata.cloud`)에서 오는데, 목록 한 화면이 20여 장을 한꺼번에
 * 요청하면 게이트웨이가 **일부만** 거절하거나 늦게 내줍니다. 그러면 그 카드만 영영
 * 빈 칸으로 남습니다 — "카드 몇 장만 안 뜬다 / 오래 걸린다" 가 이렇게 생깁니다.
 * 곧바로 다시 걸면 같은 이유로 또 막히므로 물러섰다 겁니다.
 */
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 700;

/**
 * 포토카드 아트.
 *
 * `imageUrl` 이 있으면 실제 그림, 없으면 시드 기반 SVG 를 그립니다.
 * (시드 SVG 는 외부 이미지 서비스를 쓰지 않아 오프라인에서도 깨지지 않습니다)
 */
export function PocaArt({ seed, imageUrl, alt, className }: Props) {
  /* 🔴 key 로 갈아 끼웁니다. 그림 주소가 바뀌면 재시도 횟수·로딩 상태가 **처음부터**
     시작해야 하는데, 같은 컴포넌트를 재사용하면 앞 카드의 실패 기록이 따라옵니다. */
  if (imageUrl) {
    return <PocaPhoto key={imageUrl} url={imageUrl} seed={seed} alt={alt} className={className} />;
  }
  return <PocaSeedArt seed={seed} alt={alt} className={className} />;
}

/** 실제 그림 한 장 — 받는 동안 자리를 채우고, 실패하면 물러섭니다 */
function PocaPhoto({
  url,
  seed,
  alt,
  className,
}: {
  url: string;
  seed: string;
  alt: string;
  className?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [givenUp, setGivenUp] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /* 🔴 다 실패하면 **빈 칸으로 두지 않고** 시드 SVG 로 물러섭니다.
     목록에 구멍이 뚫린 것보다 낫습니다.
     ⚠️ 대신 이때 보이는 그림은 **그 카드의 진짜 그림이 아닙니다.** */
  if (givenUp) return <PocaSeedArt seed={seed} alt={alt} className={className} />;

  const retry = () => {
    if (attempt >= MAX_RETRIES) {
      setGivenUp(true);
      return;
    }
    timer.current = setTimeout(() => setAttempt((n) => n + 1), RETRY_BASE_MS * (attempt + 1));
  };

  return (
    <div className={cn('relative aspect-[2/3] w-full overflow-hidden rounded-lg', className)}>
      {/* 받는 동안 자리를 채웁니다. 예전에는 아무것도 없어서, 느린 카드 한 장이
       **비어 있는 네모**로 남아 고장난 것처럼 보였습니다. */}
      {!loaded && <Skeleton className="absolute inset-0 size-full rounded-none" />}

      <img
        /* 실패한 주소에 src 를 다시 넣어도 브라우저는 재요청하지 않습니다.
           key 를 바꿔 <img> 를 새로 만들어야 다시 받습니다. */
        key={attempt}
        src={url}
        alt={alt}
        loading="lazy"
        /* 디코딩을 메인 스레드 밖으로 — 큰 그림이 목록 스크롤을 붙잡지 않게 */
        decoding="async"
        /* 길게 누르면 브라우저가 이미지 드래그·저장을 가로채면서 pointercancel 이 옵니다.
           그러면 기울이기가 중간에 끊깁니다. (PocaFullscreen 주석 참고) */
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={retry}
        className={cn(
          'size-full object-cover transition-opacity duration-200',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}

/**
 * 시드 기반 SVG.
 *
 * 그림이 없거나 끝내 못 받았을 때의 기본값입니다. 네트워크를 타지 않습니다.
 */
function PocaSeedArt({ seed, alt, className }: { seed: string; alt: string; className?: string }) {
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
