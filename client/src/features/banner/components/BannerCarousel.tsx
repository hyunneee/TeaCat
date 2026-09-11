import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/shared/hooks';
import { cn } from '@/shared/lib';
import type { Banner } from '../model/banner.types';

interface Props {
  banners: Banner[];
  onSelect: (banner: Banner) => void;
  /** 자동 전환 간격(ms) */
  intervalMs?: number;
}

/** 시드 → 색상 (같은 배너는 항상 같은 색) */
function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

const SWIPE_THRESHOLD = 40;

/**
 * 광고·이벤트 배너 슬라이더. **4:3 비율**이고, 넓은 화면(lg)에서만 **21:9** 입니다.
 *
 * 폰의 4:3 을 그대로 넓은 화면에 쓰면 배너 하나가 700px 넘는 벽이 되어
 * 첫 화면에 배너밖에 안 보입니다. 가로로 긴 히어로로 바꿉니다.
 *
 * ⚠️ **폰 비율(4:3)** 을 바꾸면 홈의 검정/하양 경계가 어긋납니다.
 *    `styles/index.css` 의 `--banner-height` 도 함께 고쳐야 합니다.
 *    lg 비율은 무관합니다 — 그 경계판은 데스크톱에서 감춥니다(HomePage).
 *
 * 구현 메모
 *  - transform 으로 트랙을 미는 방식입니다. 슬라이드마다 컴포넌트를
 *    새로 마운트하지 않으므로 전환 중 깜빡임이 없습니다.
 *  - 자동 전환은 사용자가 손으로 넘긴 뒤 잠시 멈춥니다. 읽는 중에
 *    화면이 넘어가면 짜증나기 때문입니다.
 *  - `prefers-reduced-motion` 이면 자동 전환을 하지 않습니다.
 *  - 점·순번은 배너 안에 겹쳐 둡니다. 배너 밖에 두면 홈의 흑백 경계를
 *    배너 높이만으로 계산할 수 없어 복잡해집니다.
 */
export function BannerCarousel({ banners, onSelect, intervalMs = 3500 }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const touchStartX = useRef<number | null>(null);
  const resumeTimer = useRef<number | null>(null);

  const count = banners.length;

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);

      // 손으로 넘겼으면 자동 전환을 잠시 쉬게 합니다.
      setPaused(true);
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
      resumeTimer.current = window.setTimeout(() => setPaused(false), intervalMs * 2);
    },
    [count, intervalMs],
  );

  // 자동 전환
  useEffect(() => {
    if (count <= 1 || paused || reduced) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => window.clearInterval(id);
  }, [count, paused, reduced, intervalMs]);

  useEffect(
    () => () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    },
    [],
  );

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="이벤트 배너"
      className="shadow-pop relative overflow-hidden rounded-lg"
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        const end = e.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start === null || end === undefined) return;
        const delta = end - start;
        if (Math.abs(delta) < SWIPE_THRESHOLD) return;
        goTo(index + (delta < 0 ? 1 : -1));
      }}
    >
      {/* 트랙 */}
      <div
        className={cn('flex', !reduced && 'transition-transform duration-500 ease-out')}
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((banner, i) => {
          /* 이미지가 없을 때만 쓰는 폴백 색. 같은 배너는 항상 같은 색이 나옵니다 */
          const h = hueOf(String(banner.bannerId));

          return (
            <button
              key={banner.bannerId}
              type="button"
              // 화면에 안 보이는 슬라이드는 탭 순서에서 빼야 키보드가 헤매지 않습니다.
              tabIndex={i === index ? 0 : -1}
              aria-hidden={i !== index}
              onClick={() => onSelect(banner)}
              style={{
                backgroundImage: banner.imageUrl
                  ? `url(${banner.imageUrl})`
                  : `linear-gradient(150deg,
                      oklch(0.42 0.14 ${h}) 0%,
                      oklch(0.3 0.11 ${(h + 40) % 360}) 60%,
                      oklch(0.19 0.06 ${(h + 75) % 360}) 100%)`,
              }}
              className="relative flex aspect-[4/3] w-full shrink-0 basis-full items-end bg-cover bg-center p-5 text-left lg:aspect-[21/9] lg:p-8"
            >
              {/* 글자가 읽히도록 아래쪽을 어둡게 */}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70"
              />

              <span className="relative min-w-0 pb-4">
                {banner.label && (
                  <span className="inline-flex rounded bg-white px-2 py-0.5 text-[0.6875rem] font-bold text-black">
                    {banner.label}
                  </span>
                )}
                <span className="mt-2.5 block text-xl leading-tight font-bold text-white">
                  {banner.title}
                </span>
                {banner.subtitle && (
                  <span className="mt-1 block text-[0.8125rem] text-white/85">{banner.subtitle}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {count > 1 && (
        <>
          {/* 순번 */}
          <span className="absolute top-3 right-3 rounded bg-black/45 px-1.5 py-0.5 text-[1rem] font-semibold text-white/90 tabular-nums">
            {index + 1} / {count}
          </span>

          {/* 점 — 누르면 해당 배너로 */}
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {banners.map((banner, i) => (
              <button
                key={banner.bannerId}
                type="button"
                aria-label={`${i + 1}번째 배너 보기`}
                aria-current={i === index}
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i);
                }}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/45',
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
