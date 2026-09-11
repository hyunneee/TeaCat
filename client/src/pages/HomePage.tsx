import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ChevronRight,
  Hourglass,
  Coins,
  Images,
  ScanFace,
  Search,
  Ticket,
  UserRound,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CatMascot,
  LiveDot,
  Logo,
  PosterImage,
  SectionTitle,
  Skeleton,
} from '@/shared/components/ui';
import { Loading, Stagger } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useAutoScroll } from '@/shared/hooks';
import { useAuth } from '@/features/auth';
import { BannerCarousel, useBanners, type Banner } from '@/features/banner';
import { ResumeBookingCard, useActiveHold } from '@/features/booking';
import { isConcertOpen, posterSeedOf, useConcerts } from '@/features/concert';

/**
 * 바로가기 — **5칸 한 줄.**
 *
 * 전부 "내 것" 으로 가는 길입니다. 공연·포카 **탐색**은 하단 탭에 이미 있어서
 * 여기에 또 두면 같은 목적지가 화면에 두 번 나옵니다.
 * 라벨은 4글자 이하로 — 한 칸이 62px 라 넘치면 두 줄로 접힙니다.
 */
const SHORTCUTS = [
  { to: ROUTES.MY_TICKETS, label: '내 티켓', icon: Ticket },
  { to: ROUTES.MY_RESALE, label: '취소표', icon: Hourglass },
  { to: ROUTES.TOKEN, label: '캣머니', icon: Coins },
  { to: ROUTES.MY_NFTS, label: '내 포카', icon: Images },
  { to: ROUTES.MY, label: '마이', icon: UserRound },
] as const;

/** 가로 레일에 몇 장까지 실을지. 너무 많으면 끝까지 미는 사람이 없습니다. */
const RAIL_LIMIT = 8;

/**
 * 홈.
 *
 * ── 화면 순서 ─────────────────────────────────────────────
 *   헤더(서비스명 · 검색) → 캐러셀 → 바로가기 5칸 → 진행 중인 티켓팅(가로 레일)
 *
 * ── 검정/하양 경계 구조 ────────────────────────────────────
 * 상단바와 배너 위쪽 90% 는 짙은 회검정, 배너 아래 10% 부터는 흰 배경입니다.
 * 배너가 검정에서 흰 영역으로 걸쳐 내려오면서 떠 있는 느낌을 만듭니다.
 *
 *   ┌───────────────┐
 *   │ ███ 검정 ████ │  상단바 (티캣 · 검색)
 *   │  ┌─────────┐  │
 *   │  │  배너   │  │  4:3
 *   │  ├ ─ ─ ─ ─ ┤  │  ← 경계 (배너 높이의 90%)
 *   │  └─────────┘  │
 *   │ ░░░ 하양 ░░░░ │  바로가기 · 목록
 *   └───────────────┘
 *
 * 경계 높이는 JS 로 재지 않고 `--banner-height`(styles/index.css) 로 계산합니다.
 * 헤더 여백·배너 여백·배너 비율을 바꾸면 아래 식도 함께 고쳐야 합니다. (DESIGN.md 10장)
 */
export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoggedIn } = useAuth();
  const { data: concerts, isPending } = useConcerts();
  const { data: banners, isPending: bannersPending } = useBanners();
  /* 결제창을 닫고 나와도 자리는 잡혀 있습니다. 돌아갈 길이 없으면 10분 동안
     본인도 남도 그 자리를 못 삽니다 (서버 GET /me/holds) */
  const { hold: activeHold, remainSeconds: holdRemainSeconds } = useActiveHold();

  const open = concerts?.filter((c) => isConcertOpen(c)).slice(0, RAIL_LIMIT) ?? [];

  /* 레일이 스스로 흐릅니다. 손을 대면 멈추고 잠시 뒤 다시 움직입니다.
     포토카드 레일이 돌아오면 **속도를 다르게** 두세요 (그때는 9). 같으면 두 줄이
     한 덩어리처럼 같이 밀려서 화면 전체가 흔들리는 것처럼 보입니다. */
  const concertRail = useAutoScroll<HTMLDivElement>({ enabled: open.length > 1, speed: 15 });

  /**
   * 얼굴 등록으로 보낼 때는 **지금 위치를 함께 넘깁니다.**
   * 안 넘기면 등록을 마친 뒤 useFaceRegistration 의 기본값(마이페이지)으로 가버려서,
   * 홈에서 눌렀는데 엉뚱한 화면에 놓이게 됩니다.
   */
  const goFaceRegister = () => navigate(ROUTES.FACE_REGISTER, { state: { from: location } });

  /**
   * 배너를 눌렀을 때 어디로 갈지.
   *
   * 공연 배너는 공연 ID 만 오므로 여기서 경로를 만듭니다 — 서버가 `/concerts/3` 같은
   * 문자열을 주면 프론트에서 경로를 바꿀 때 서버까지 고쳐야 합니다. (CLAUDE.md 3-5)
   * 나머지는 관리자가 적어 둔 서비스 내 경로로 그대로 이동합니다. 둘 다 없으면 안내용이라 가만히 둡니다.
   */
  const openBanner = (banner: Banner) => {
    if (banner.performanceId !== null) {
      navigate(ROUTES.CONCERT_DETAIL(String(banner.performanceId)));
    } else if (banner.linkPath) {
      navigate(banner.linkPath);
    }
  };

  return (
    <div className="relative">
      {/* 짙은 배경판 — 상단바 + 배너 위쪽 90% 를 덮습니다 */}
      <div
        aria-hidden
        className="surface-strong absolute inset-x-0 top-0 lg:hidden"
        style={{
          /* env(노치) + 헤더 위 여백 + 헤더 높이 + 배너 위 여백 + 배너의 90% */
          height:
            'calc(env(safe-area-inset-top) + 0.75rem + var(--spacing-header) + 0.5rem + var(--banner-height) * 0.9)',
        }}
      />

      {/* 같은 배경판의 데스크톱판.
          규칙은 폰과 **똑같습니다** — 배너 위쪽 90% 까지 짙은 면이고, 배너가 그
          경계에 걸쳐 내려옵니다. 다른 것은 둘뿐입니다.

          1. 위로 덮을 상단바가 없습니다 (그 헤더는 lg 에서 숨기고 TopNav 가 대신합니다)
             → 본문 맨 위에서 시작합니다. AppLayout 이 본문에 위 여백을 주지 않는
               이유도 이것입니다 — 여백이 있으면 내비와 이 면 사이에 흰 띠가 생깁니다.
          2. **화면 끝까지** 갑니다(`w-screen`). 본문 폭(1024px)에서 끊으면 짙은 면이
             화면 한가운데 떠 있는 네모가 되어 배경이 아니라 카드처럼 보입니다.
             가로 스크롤은 AppLayout 의 `overflow-x-clip` 이 막습니다.

          높이는 `--banner-height` 가 lg 에서 21:9 로 다시 계산됩니다 (styles/index.css) */}
      <div
        aria-hidden
        className="surface-strong absolute top-0 left-1/2 hidden w-screen -translate-x-1/2 lg:block"
        style={{ height: 'calc(1.5rem + var(--banner-height) * 0.9)' }}
      />

      {/* ── 최상단 줄 (검정 위) ──
          데스크톱에서는 감춥니다 — 상단 내비(TopNav)에 로고와 검색이 이미 있어서
          그대로 두면 로고가 한 화면에 두 번 나옵니다. */}
      <header className="relative pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:hidden">
        <div className="flex h-(--spacing-header) items-center justify-between px-4">
          {/* 마스코트만 크게 — 글자는 26 기준(18px)이라 헤더 높이를 넘지 않습니다 */}
          <span className="text-white">
            <Logo size={26} markSize={39} invert />
          </span>

          {/* 검색은 아이콘 하나로. 입력창을 헤더에 두면 로고 자리가 좁아집니다.
              누르면 공연·포카를 함께 찾는 검색 화면으로 갑니다. */}
          <button
            type="button"
            aria-label="검색"
            onClick={() => navigate(ROUTES.SEARCH)}
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/12 active:bg-white/20"
          >
            <Search size={26} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      {/* ── 배너 (검정 → 하양 경계에 걸침) ── */}
      {/* 넓은 화면에서는 좌우 여백을 본문(AppLayout 의 px-6)에 맡깁니다 */}
      <div className="relative px-4 pt-2 lg:px-0 lg:pt-6">
        {bannersPending ? (
          <Skeleton className="aspect-[4/3] w-full rounded-lg lg:aspect-[21/9] lg:rounded-2xl" />
        ) : (
          banners && <BannerCarousel banners={banners} onSelect={openBanner} />
        )}
      </div>

      {/* ── 흰 배경 영역 ── */}
      <div className="relative space-y-6 px-4 pt-6 lg:space-y-10 lg:px-0 lg:pt-8">
        {/* 바로가기 — 아이콘 타일 + 아래 라벨.

            폰에서는 흰 타일 다섯 개가 오프화이트 바탕 위에 떠 있는 것으로 충분합니다
            (폭이 좁아 그 자체가 한 줄로 읽힙니다). 넓은 화면에서는 같은 타일이
            빈 벌판에 흩어진 점 다섯 개가 됩니다 — **하나의 면**으로 묶습니다.
            묶은 면이 흰색이므로 안쪽 타일은 흰색·그림자를 거둡니다.
            같은 층을 두 번 쌓으면 타일이 면에서 또 떠 보입니다. */}
        <Stagger
          as="ul"
          className="grid grid-cols-5 gap-x-1.5 lg:bg-surface-1 lg:shadow-card lg:gap-x-4 lg:rounded-2xl lg:px-8 lg:py-7"
        >
          {SHORTCUTS.map(({ to, label, icon: Icon }) => (
            <Stagger.Item as="li" key={label}>
              <motion.button
                type="button"
                onClick={() => navigate(to)}
                whileTap={{ scale: 0.93 }}
                className="flex w-full flex-col items-center gap-1.5"
              >
                {/* 흰 면 + 얕은 그림자. 회색 면은 "비활성" 처럼 보입니다. */}
                {/* `.surface` 대신 `bg-surface-1` 을 씁니다 — `.surface` 는 유틸리티
                    레이어의 **평범한 CSS 클래스**라 `lg:` 변형이 이기지 못합니다
                    (같은 레이어·같은 specificity → 나중에 선언된 쪽이 이김).
                    색은 같은 값이라 폰에서 보이는 것은 달라지지 않습니다. */}
                <span className="bg-surface-1 shadow-card text-ink lg:bg-surface-2 flex size-14 items-center justify-center rounded-2xl lg:size-[3.25rem] lg:shadow-none">
                  <Icon size={26} strokeWidth={1.7} />
                </span>
                <span className="text-ink text-center text-[0.75rem] leading-tight font-semibold">
                  {label}
                </span>
              </motion.button>
            </Stagger.Item>
          ))}
        </Stagger>

        {/* 시간이 걸린 일이라 얼굴 등록 안내보다 위입니다 */}
        {activeHold && (
          <ResumeBookingCard
            hold={activeHold}
            remainSeconds={holdRemainSeconds}
            onContinue={() => navigate(ROUTES.BOOKING_REVIEW(activeHold.scheduleId))}
          />
        )}

        {isLoggedIn && user && !user.faceRegistered && (
          <Card
            tone="warning"
            interactive
            onClick={goFaceRegister}
            className="flex items-center gap-3"
          >
            <span className="bg-brand-900 flex size-11 shrink-0 items-center justify-center rounded-xl text-white">
              <ScanFace size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">얼굴 등록을 완료해 주세요</p>
              <p className="text-muted mt-0.5 text-xs">등록해야 티켓을 사용할 수 있어요.</p>
            </div>
            <ChevronRight size={18} className="text-subtle shrink-0" />
          </Card>
        )}

        {!isLoggedIn && (
          <Card tone="brand" className="space-y-4">
            <div className="flex items-center gap-3">
              <CatMascot size={52} />
              <div className="min-w-0">
                <p className="font-bold">로그인하고 예매를 시작하세요</p>
                <p className="text-muted mt-0.5 text-xs">
                  얼굴 등록까지 마치면 입장 준비 완료예요.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="dark" fullWidth onClick={() => navigate(ROUTES.LOGIN)}>
                로그인
              </Button>
              <Button variant="secondary" fullWidth onClick={() => navigate(ROUTES.SIGNUP)}>
                회원가입
              </Button>
            </div>
          </Card>
        )}

        {/* 진행 중인 티켓팅 — 세로로 쌓지 않고 옆으로 밉니다.
            세로로 쌓으면 두 장만 보여도 화면이 다 차서 아래 내용이 밀려납니다. */}
        <section>
          <SectionTitle
            action={
              <button
                type="button"
                onClick={() => navigate(ROUTES.CONCERTS)}
                className="text-subtle hover:text-ink flex items-center text-sm transition-colors"
              >
                더보기 <ChevronRight size={13} />
              </button>
            }
          >
            진행 중인 티켓팅
          </SectionTitle>

          {isPending ? (
            /* 홈은 페이지 일부라 화면 가운데로 밀지 않습니다 (min-h-0) */
            <Loading label="공연을 불러오는 중" className="min-h-0 py-8" />
          ) : (
            /* -mx-4 로 화면 끝까지 흐르게 하고, 안쪽 px-4 로 첫/마지막 카드를 맞춥니다.
               그래야 옆에 다음 카드가 살짝 걸쳐 보여 "더 있다"는 게 읽힙니다. */
            <div ref={concertRail} className="-mx-4 overflow-x-auto lg:mx-0">
              <ul className="flex w-max gap-3 px-4 pt-1 pb-2 lg:gap-4 lg:px-0">
                {open.map((concert) => (
                  <li key={concert.concertId} className="w-[8.5rem] shrink-0 lg:w-[10.5rem]">
                    <motion.button
                      type="button"
                      onClick={() => navigate(ROUTES.CONCERT_DETAIL(String(concert.concertId)))}
                      whileTap={{ scale: 0.97 }}
                      className="w-full text-left"
                    >
                      <div className="relative">
                        <PosterImage
                          src={concert.posterUrl}
                          seed={posterSeedOf(concert)}
                          alt={`${concert.title} 포스터`}
                          className="w-full"
                        />
                        <span className="absolute top-1.5 left-1.5">
                          <Badge tone="live" icon={<LiveDot />} className="shadow-card">
                            예매중
                          </Badge>
                        </span>
                      </div>

                      <p className="mt-2 truncate text-[0.875rem] font-bold">{concert.title}</p>
                      <p className="text-ink-muted truncate text-[0.8125rem]">
                        {concert.stadiumName}
                      </p>
                    </motion.button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 🔴 "새로 올라온 포토카드" 레일은 1차 배포에서 뺐습니다.
            마켓(구매·판매)이 닫혀 있어(`/nft` → ComingSoonPage) 살 수 없는 물건을
            홈에서 권하는 꼴이 됩니다. 2차 배포 때 이 자리에 되돌립니다 —
            `useNftMarket()` 조회와 `pocaRail` 자동 스크롤도 함께 지웠습니다. */}
      </div>
    </div>
  );
}
