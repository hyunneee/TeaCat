import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
 * 광고·이벤트 배너 슬라이더.
 *
 * ── 폭에 따라 두 가지로 보입니다 ───────────────────────────
 *   ~64rem   화면 폭을 꽉 쓰는 **4:3** 한 장. 옆 배너는 안 보입니다.
 *   64rem~   본문 폭의 **21:9** 한 장이 가운데, 앞뒤 배너가 좌우에 살짝 걸침.
 *
 * 폰의 4:3 을 그대로 넓은 화면에 쓰면 배너 하나가 700px 넘는 벽이 되어
 * 첫 화면에 배너밖에 안 보입니다. 그래서 가로로 긴 히어로로 바꿉니다.
 *
 * ⚠️ **폰 비율(4:3)** 을 바꾸면 홈의 초록/하양 경계가 어긋납니다.
 *    `styles/index.css` 의 `--banner-height` 도 함께 고쳐야 합니다.
 *    lg 비율도 같은 곳에서 21:9 로 다시 계산합니다.
 *
 * ── 앞뒤가 걸쳐 보이는 구조 ────────────────────────────────
 * 겹이 셋입니다. 하나라도 역할을 섞으면 옆 배너가 안 보이거나 가로 스크롤이 생깁니다.
 *
 *   section  넓은 화면에서 **화면 폭**(`w-screen`)이고 여기서 잘라냅니다.
 *            → 창 밖으로 나간 앞뒤 배너가 화면 끝에서 잘립니다.
 *   창(窓)   **배너 한 장 + 간격** 폭이고 가운데. overflow 는 열어 둡니다.
 *   칸       창과 같은 폭. 좌우 여백이 간격을 만들고, 그 안쪽이 배너 한 장입니다.
 *   트랙     칸들을 가로로 늘어놓고 `index × 100%` 만큼 밀립니다.
 *
 * 창을 **배너 폭이 아니라 배너+간격 폭**으로 잡은 것이 요령입니다.
 * 그래야 `100%`(= 트랙 폭 = 창 폭)가 곧 한 칸의 간격이 되어, 미는 거리가
 * `index × 100%` 로 끝납니다 — 간격을 거리 계산에 끌어들이지 않습니다.
 * (창을 배너 폭으로 두면 밀 때마다 간격을 더해야 하고, 그 식이 여기저기 흩어집니다)
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
      /* 넓은 화면에서는 화면 폭까지 벌려 **여기서 잘라냅니다.** 본문 폭에서 자르면
         앞뒤 배너가 걸쳐 보일 자리가 없습니다. 모서리 둥글기는 그때 배너 각 장이
         맡습니다 (이 요소는 화면 끝까지라 둥글게 할 것이 없습니다). */
      className="shadow-pop relative overflow-hidden rounded-lg lg:left-1/2 lg:w-screen lg:-translate-x-1/2 lg:rounded-none lg:shadow-none"
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
      {/* ── 창 — 배너 한 장 + 간격. 점·순번·화살표의 기준입니다 ──
          간격만큼 배너보다 넓습니다. 그래야 창 = 한 칸의 **정확한 간격(pitch)** 이 되고,
          트랙을 `100%` 단위로만 밀 수 있습니다 (아래 참고). 폰에서는 간격이 0 이라
          창과 배너가 같은 폭입니다. */}
      <div className="relative mx-auto w-full lg:w-[calc(var(--banner-width)+var(--banner-gap))]">
        {/* ── 트랙 ──
            간격을 flex `gap` 이 아니라 **각 칸의 좌우 여백**으로 넣었습니다.
            그래야 한 칸이 통째로 창 폭(=배너+간격)과 같아져서, 미는 거리가
            `index × 100%` 로 떨어집니다. `gap` 을 쓰면 거리에 간격을 따로
            더해야 하고, 그 식을 한 군데라도 놓치면 넘길수록 조금씩 밀려납니다. */}
        <div
          className={cn('flex', !reduced && 'transition-transform duration-500 ease-out')}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((banner, i) => {
            /* 이미지가 없을 때만 쓰는 폴백 색. 같은 배너는 항상 같은 색이 나옵니다 */
            const h = hueOf(String(banner.bannerId));
            const active = i === index;

            return (
              /* 칸 — 창과 **같은 폭**이고, 간격은 이 칸의 좌우 여백이 만듭니다.
                 (배너에 직접 여백을 주면 배경 그림 안쪽이 비어 보입니다) */
              <div
                key={banner.bannerId}
                className="w-full shrink-0 basis-full lg:px-[calc(var(--banner-gap)/2)]"
              >
                <button
                  type="button"
                  // 화면에 안 보이는 슬라이드는 탭 순서에서 빼야 키보드가 헤매지 않습니다.
                  tabIndex={active ? 0 : -1}
                  aria-hidden={!active}
                  /* 넓은 화면에서는 옆 배너가 눈에 보이므로 눌러집니다. 그때는 **그 배너로
                   옮기고**, 가운데 것을 눌렀을 때만 목적지로 보냅니다 — 반쯤 가려진
                   것을 눌렀는데 페이지가 넘어가면 누른 사람 입장에서는 오작동입니다.
                   (키보드·스크린리더는 아래 화살표와 점으로 같은 일을 합니다) */
                  onClick={() => (active ? onSelect(banner) : goTo(i))}
                  style={{
                    backgroundImage: banner.imageUrl
                      ? `url(${banner.imageUrl})`
                      : `linear-gradient(150deg,
                        oklch(0.42 0.14 ${h}) 0%,
                        oklch(0.3 0.11 ${(h + 40) % 360}) 60%,
                        oklch(0.19 0.06 ${(h + 75) % 360}) 100%)`,
                  }}
                  className={cn(
                    'relative flex aspect-[4/3] w-full items-end bg-cover bg-center p-5 text-left',
                    /* 넓은 화면에서는 각 장이 스스로 둥글어집니다 (section 이 화면 폭이라
                     거기서 둥글게 할 수 없습니다). 아래는 각지게 — 바로 밑에 바로가기
                     면이 이어 붙습니다 (HomePage). */
                    'lg:aspect-[21/9] lg:rounded-t-2xl lg:p-8',
                  )}
                >
                  {/* 글자가 읽히도록 아래쪽을 어둡게 */}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 lg:rounded-t-2xl"
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
                      <span className="mt-1 block text-[0.8125rem] text-white/85">
                        {banner.subtitle}
                      </span>
                    )}
                  </span>

                  {/* 지금 것이 아닌 장은 **어둡게 덮습니다.** 셋 다 또렷하면 어느 것이
                    지금 보는 배너인지 눈이 못 고릅니다.
                    글자까지 함께 덮으려고 **맨 마지막**에 둡니다 — 글자 앞에 두면
                    그림만 어두워지고 제목은 그대로라 옆 배너가 더 튑니다.
                    🔴 `opacity` 로 흐리게 하면 안 됩니다 — 장이 반투명해지면서 뒤에
                       있는 홈의 초록/하양 경계선이 배너를 가로질러 비쳐 보입니다.
                       덮개는 장을 불투명하게 유지합니다. */}
                  {!active && (
                    <span
                      aria-hidden
                      className="absolute inset-0 hidden bg-black/65 lg:block lg:rounded-t-2xl"
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {count > 1 && (
          /* 조작 요소는 **창이 아니라 가운데 배너**를 기준으로 놓습니다.
             창은 간격만큼 더 넓어서, 창에 맞추면 순번과 화살표가 배너 밖으로
             간격의 절반만큼 삐져나옵니다. 여백으로 그만큼 좁힙니다.
             자리만 잡는 층이라 클릭은 통과시키고(`pointer-events-none`),
             실제 버튼에서만 다시 켭니다. */
          <div className="pointer-events-none absolute inset-0 lg:mx-[calc(var(--banner-gap)/2)]">
            {/* 순번 */}
            <span className="absolute top-3 right-3 rounded bg-black/45 px-1.5 py-0.5 text-[1rem] font-semibold text-white/90 tabular-nums">
              {index + 1} / {count}
            </span>

            {/* 화살표 — **넓은 화면에만.** 폰에서는 손가락으로 넘기면 되고,
                44px 짜리 버튼 두 개가 좁은 배너 위 글자를 가립니다.
                창 안쪽 가장자리에 둡니다 — 창 밖에 두면 반쯤 흐려진 옆 배너 위에
                얹혀서 무엇을 누르는 버튼인지 헷갈립니다. */}
            <button
              type="button"
              aria-label="이전 배너"
              onClick={() => goTo(index - 1)}
              className="pointer-events-auto absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 lg:flex"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              aria-label="다음 배너"
              onClick={() => goTo(index + 1)}
              className="pointer-events-auto absolute top-1/2 right-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 lg:flex"
            >
              <ChevronRight size={22} />
            </button>

            {/* 점 — 누르면 해당 배너로 */}
            <div className="pointer-events-auto absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
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
          </div>
        )}
      </div>
    </section>
  );
}
