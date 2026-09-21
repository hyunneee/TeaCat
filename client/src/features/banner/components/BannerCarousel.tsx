import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useReducedMotion } from '@/shared/hooks';
import { cn } from '@/shared/lib';
import { objectPositionOf } from '../model/bannerFocus';
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
 *   64rem~   본문 폭의 **2:1** 한 장이 가운데, 앞뒤 배너가 좌우에 살짝 걸침.
 *            걸치는 앞뒤 배너는 **조금 작게**(85%) 그려 가운데와 층을 만듭니다.
 *
 * 폰의 4:3 을 그대로 넓은 화면에 쓰면 배너 하나가 700px 넘는 벽이 되어
 * 첫 화면에 배너밖에 안 보입니다. 그래서 가로로 긴 히어로로 바꿉니다.
 *
 * ⚠️ **폰 비율(4:3)** 을 바꾸면 홈의 초록/하양 경계가 어긋납니다.
 *    `styles/index.css` 의 `--banner-height` 도 함께 고쳐야 합니다.
 *    lg 비율도 같은 곳에서 2:1 로 다시 계산합니다.
 *
 * ── 앞뒤가 걸쳐 보이는 구조 ────────────────────────────────
 * 겹이 넷입니다. 하나라도 역할을 섞으면 옆 배너가 안 보이거나 가로 스크롤이 생깁니다.
 *
 *   section  넓은 화면에서 **화면 폭**(`w-screen`)이고 여기서 잘라냅니다.
 *            → 창 밖으로 나간 앞뒤 배너가 화면 끝에서 끊깁니다.
 *   창(窓)   **배너 한 장 + 간격** 폭이고 가운데. overflow 는 열어 둡니다.
 *   칸       창과 같은 폭. 좌우 여백이 간격을 만들고, 그 안쪽이 배너 한 장입니다.
 *   트랙     칸들을 가로로 늘어놓고 `자리 × 100%` 만큼 밀립니다.
 *
 * 창을 배너 폭이 아니라 배너+간격 폭으로 잡은 것이 요령입니다. 그래야 `100%`
 * (= 트랙 폭 = 창 폭)가 곧 한 칸의 간격이 되어, 미는 거리가 `자리 × 100%` 로
 * 끝납니다 — flex `gap` 을 쓰면 미는 식마다 간격을 더해야 하고, 한 군데만
 * 놓쳐도 넘길수록 밀려납니다.
 *
 * ── 원형으로 돕니다 (앞뒤에 복제 한 장씩) ───────────────────
 * 첫 배너 왼쪽에는 **마지막 배너**가, 마지막 배너 오른쪽에는 **첫 배너**가 걸쳐
 * 보여야 합니다. 그래서 칸을 이렇게 깝니다.
 *
 *   [마지막 복제] [1] [2] … [N] [첫 복제]
 *    자리 0        1   2      N   N+1
 *
 * 끝(0 또는 N+1)까지 밀고 나면 **전환이 끝난 뒤** 같은 그림의 실제 자리로
 * 소리 없이 옮겨 앉습니다(N+1 → 1, 0 → N). 그 순간만 전환을 꺼야(`snap`)
 * 되돌아가는 애니메이션이 보이지 않습니다. 그림이 같으니 눈에는 아무 일도
 * 일어나지 않습니다.
 *
 * 🔴 복제를 쓰지 않고 "각 장을 현재 기준 상대 위치로 놓는" 방법은 안 됩니다.
 *    N=3 에서 한 칸 넘기면 왼쪽에 있던 장이 오른쪽으로 가야 하는데,
 *    그 자리가 **화면에 보이는 자리**라 장이 화면을 가로질러 날아갑니다.
 *
 * 구현 메모
 *  - transform 으로 트랙을 미는 방식입니다. 슬라이드마다 컴포넌트를
 *    새로 마운트하지 않으므로 전환 중 깜빡임이 없습니다.
 *  - 자동 전환은 사용자가 손으로 넘긴 뒤 잠시 멈춥니다. 읽는 중에
 *    화면이 넘어가면 짜증나기 때문입니다.
 *  - `prefers-reduced-motion` 이면 자동 전환을 하지 않습니다. 전환이 없으면
 *    `transitionend` 도 없으므로 복제 칸에 들르지 않고 바로 실제 자리로 갑니다.
 *  - 점·순번은 배너 안에 겹쳐 둡니다. 배너 밖에 두면 홈의 흑백 경계를
 *    배너 높이만으로 계산할 수 없어 복잡해집니다.
 */
export function BannerCarousel({ banners, onSelect, intervalMs = 3500 }: Props) {
  const count = banners.length;
  /** 복제를 깔 만큼 배너가 있는가. 한 장뿐이면 넘길 것도 돌 것도 없습니다 */
  const looped = count > 1;

  /** 트랙에서 지금 창에 와 있는 **칸 번호**. 복제를 깔았으면 실제 첫 장은 1번입니다 */
  const [pos, setPos] = useState(looped ? 1 : 0);
  /** 이번 렌더에서만 전환을 끕니다 (복제 칸 → 실제 칸으로 옮겨 앉을 때) */
  const [snap, setSnap] = useState(false);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const touchStartX = useRef<number | null>(null);
  const resumeTimer = useRef<number | null>(null);

  /** 사용자에게 보여줄 **실제 배너 번호** (0-based). 순번·점이 이 값을 씁니다 */
  const real = looped ? (((pos - 1) % count) + count) % count : 0;

  /** 손으로 넘겼으면 자동 전환을 잠시 쉬게 합니다 */
  const pause = useCallback(() => {
    setPaused(true);
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setPaused(false), intervalMs * 2);
  }, [intervalMs]);

  /** 한 칸 옮기기 (화살표·스와이프) */
  const step = useCallback(
    (delta: number) => {
      if (!looped) return;
      setSnap(false);
      /* 전환이 없으면 복제 칸에 들러 봐야 되돌아올 계기(`transitionend`)가 없습니다.
         그때는 처음부터 실제 자리로 갑니다. */
      setPos((p) => (reduced ? ((((p - 1 + delta) % count) + count) % count) + 1 : p + delta));
      pause();
    },
    [looped, reduced, count, pause],
  );

  /** 특정 배너로 (점) */
  const goTo = useCallback(
    (target: number) => {
      if (count === 0) return;
      setSnap(false);
      setPos(looped ? target + 1 : 0);
      pause();
    },
    [count, looped, pause],
  );

  // 자동 전환
  useEffect(() => {
    if (!looped || paused || reduced) return;
    const id = window.setInterval(() => setPos((p) => p + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [looped, paused, reduced, intervalMs]);

  /* 전환을 끈 렌더는 **한 프레임만** 유지합니다. 바로 다시 켜야 다음 이동이 미끄러집니다.
     rAF 를 두 번 거치는 이유: 한 번만 두면 브라우저가 옮겨 앉은 자리를 그리기 전에
     전환이 되살아나서, 되돌아가는 애니메이션이 그대로 보입니다. */
  useEffect(() => {
    if (!snap) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSnap(false));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [snap]);

  /* 안전망 — 자리가 트랙 밖으로 나가면 조용히 제자리로.
     탭이 숨으면 브라우저가 전환을 멈춰 `transitionend` 가 오지 않는데,
     자동 전환 타이머는 계속 돌아 자리만 늘어납니다. 그대로 두면 빈 화면이 됩니다. */
  useEffect(() => {
    if (!looped || (pos >= 0 && pos <= count + 1)) return;
    setSnap(true);
    setPos(((((pos - 1) % count) + count) % count) + 1);
  }, [looped, pos, count]);

  useEffect(
    () => () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    },
    [],
  );

  if (count === 0) return null;

  /** 실제로 그릴 칸들 — 앞뒤에 복제 한 장씩 */
  const cells = looped ? [banners[count - 1]!, ...banners, banners[0]!] : banners;

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
        step(delta < 0 ? 1 : -1);
      }}
    >
      {/* ── 창 — 배너 한 장 + 간격. 점·순번·화살표의 기준입니다 ──
          간격만큼 배너보다 넓습니다. 그래야 창 = 한 칸의 정확한 간격(pitch)이 되고,
          트랙을 `100%` 단위로만 밀 수 있습니다. 폰에서는 간격이 0 이라 창과 배너가
          같은 폭입니다. */}
      <div className="relative mx-auto w-full lg:w-[calc(var(--banner-width)+var(--banner-gap))]">
        {/* ── 트랙 ──
            간격을 flex `gap` 이 아니라 **각 칸의 좌우 여백**으로 넣었습니다.
            그래야 한 칸이 통째로 창 폭과 같아져서 미는 거리가 `자리 × 100%` 로 떨어집니다. */}
        <div
          className={cn('flex', !reduced && !snap && 'transition-transform duration-500 ease-out')}
          style={{ transform: `translateX(-${pos * 100}%)` }}
          onTransitionEnd={(e) => {
            /* 자식(배너 안 요소)의 전환까지 여기로 올라옵니다. 트랙 자신의
               이동이 끝났을 때만 봅니다. */
            if (e.target !== e.currentTarget || e.propertyName !== 'transform') return;
            if (!looped) return;
            if (pos === count + 1) {
              setSnap(true);
              setPos(1);
            } else if (pos === 0) {
              setSnap(true);
              setPos(count);
            }
          }}
        >
          {cells.map((banner, cellIndex) => {
            /* 이미지가 없을 때만 쓰는 폴백 색. 같은 배너는 항상 같은 색이 나옵니다 */
            const h = hueOf(String(banner.bannerId));
            const active = cellIndex === pos;

            return (
              /* 칸 — 창과 **같은 폭**이고, 간격은 이 칸의 좌우 여백이 만듭니다.
                 (배너에 직접 여백을 주면 배경 그림 안쪽이 비어 보입니다)
                 복제가 있어 bannerId 가 겹치므로 key 는 칸 번호로 잡습니다. */
              <div
                key={`${cellIndex}-${banner.bannerId}`}
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
                  onClick={() => (active ? onSelect(banner) : step(cellIndex - pos))}
                  /* 그림이 없을 때만 쓰는 폴백. 그림이 있으면 아래 <img> 가 맡습니다 */
                  style={
                    banner.imageUrl
                      ? undefined
                      : {
                          backgroundImage: `linear-gradient(150deg,
                            oklch(0.42 0.14 ${h}) 0%,
                            oklch(0.3 0.11 ${(h + 40) % 360}) 60%,
                            oklch(0.19 0.06 ${(h + 75) % 360}) 100%)`,
                        }
                  }
                  className={cn(
                    'relative flex aspect-[4/3] w-full items-end p-5 text-left',
                    /* 넓은 화면에서는 각 장이 스스로 둥글어집니다 (section 이 화면 폭이라
                       거기서 둥글게 할 수 없습니다). `overflow-hidden` 이라 그림과
                       안쪽 덮개도 같은 모양으로 잘립니다. */
                    'lg:aspect-[2/1] lg:overflow-hidden lg:p-8',
                    /* 🔴 **옆 배너는 줄여서 뒤로 물립니다** (아래 `lg:scale-*`).
                       칸 폭은 그대로 두고 그린 것만 줄입니다 — 칸을 좁히면 미는 거리가
                       `자리 × 100%` 로 안 떨어져서 넘길 때마다 어긋납니다.
                       트랙과 **같은 500ms** 라 줄고 커지는 것이 미는 동작과 함께 끝납니다.
                       (전환을 줄이는 설정에서는 크기만 바뀌고 애니메이션은 없습니다) */
                    !reduced && 'transition-transform duration-500 ease-out',
                    /* 🔴 **가운데 장만 아래가 각집니다.** 바로 밑에 바로가기 면이 이어
                       붙어 한 덩어리가 되기 때문입니다. 좌우에 걸친 장은 밑에 아무것도
                       없으므로 네 귀퉁이가 다 둥글어야 떠 있는 카드로 읽힙니다. */
                    active ? 'lg:rounded-t-2xl' : 'lg:scale-[0.85] lg:rounded-2xl',
                  )}
                >
                  {/* 🔴 배경(`background-image`)이 아니라 `<img>` 입니다. 이유가 둘입니다.
                      ① 배경 이미지는 **프리로드 스캐너가 못 찾습니다.** HTML 파싱 → CSS 계산이
                         끝나야 요청이 나가서, 홈의 LCP 가 그만큼 늦었습니다(19.4s).
                         첫 장에 `fetchPriority="high"` 를 걸어 가장 먼저 받게 합니다.
                      ② 예전에는 모든 슬라이드에 배경을 걸어 둬서 **안 보이는 배너까지 전부**
                         내려왔습니다.
                      ⚠️ 넓은 화면에서는 **앞뒤 배너가 눈에 보입니다.** 그래서 지금 장뿐 아니라
                         양옆 칸까지 `eager` 입니다 — 옆을 lazy 로 두면 걸쳐 보이는 자리가
                         빈 채로 있다가 뒤늦게 채워집니다.
                      alt 가 빈 문자열인 건 장식이기 때문입니다 — 제목·부제가 아래 글자로 있습니다. */}
                  {banner.imageUrl && (
                    <img
                      src={banner.imageUrl}
                      alt=""
                      loading={Math.abs(cellIndex - pos) <= 1 ? 'eager' : 'lazy'}
                      fetchPriority={cellIndex === (looped ? 1 : 0) ? 'high' : 'auto'}
                      decoding="async"
                      draggable={false}
                      /* 그림 비율이 틀과 다르면 여기서 잘립니다. 어디를 남길지는 관리자가
                         배너마다 골라 둔 값입니다 — 기본(가운데)이 늘 맞지는 않습니다.
                         (공연 배너의 3:4 포스터를 2:1 로 자를 때가 가장 심합니다) */
                      style={{ objectPosition: objectPositionOf(banner.imageFocusX, banner.imageFocusY) }}
                      className="absolute inset-0 size-full object-cover"
                    />
                  )}

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
                    <span aria-hidden className="absolute inset-0 hidden bg-black/65 lg:block" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {looped && (
          /* 조작 요소는 **창이 아니라 가운데 배너**를 기준으로 놓습니다.
             창은 간격만큼 더 넓어서, 창에 맞추면 순번과 화살표가 배너 밖으로
             간격의 절반만큼 삐져나옵니다. 여백으로 그만큼 좁힙니다.
             자리만 잡는 층이라 클릭은 통과시키고(`pointer-events-none`),
             실제 버튼에서만 다시 켭니다. */
          <div className="pointer-events-none absolute inset-0 lg:mx-[calc(var(--banner-gap)/2)]">
            {/* 순번 */}
            <span className="absolute top-3 right-3 rounded bg-black/45 px-1.5 py-0.5 text-[1rem] font-semibold text-white/90 tabular-nums">
              {real + 1} / {count}
            </span>

            {/* 화살표 — **넓은 화면에만.** 폰에서는 손가락으로 넘기면 되고,
                44px 짜리 버튼 두 개가 좁은 배너 위 글자를 가립니다.
                창 안쪽 가장자리에 둡니다 — 창 밖에 두면 반쯤 어두워진 옆 배너 위에
                얹혀서 무엇을 누르는 버튼인지 헷갈립니다. */}
            <button
              type="button"
              aria-label="이전 배너"
              onClick={() => step(-1)}
              className="pointer-events-auto absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 lg:flex"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              aria-label="다음 배너"
              onClick={() => step(1)}
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
                  aria-current={i === real}
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(i);
                  }}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === real ? 'w-5 bg-white' : 'w-1.5 bg-white/45',
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
