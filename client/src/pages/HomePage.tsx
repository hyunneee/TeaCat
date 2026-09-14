import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ChevronRight,
  Hourglass,
  MessageSquare,
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
  RAIL_ANCHOR,
  Rail,
  SectionTitle,
  Skeleton,
} from '@/shared/components/ui';
import { Loading, Stagger } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { cn, formatDateTime } from '@/shared/lib';
import { useModal } from '@/app/providers';
import { can, useAuth } from '@/features/auth';
import { BannerCarousel, useBanners, type Banner } from '@/features/banner';
import { ResumeBookingCard, useActiveHolds, useReleaseMyHold } from '@/features/booking';
import {
  CONCERT_BOOKING_LABEL,
  compareForRail,
  isConcertOnRail,
  isConcertOpen,
  posterSeedOf,
  useConcerts,
} from '@/features/concert';

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
  /* 캣머니 자리였습니다. 잔액은 MY 상단에 이미 큰 숫자로 있어서 같은 목적지가 두 번
     나오는 셈이었고, 대신 막혔을 때 말할 곳이 홈에 없었습니다 */
  { to: ROUTES.MY_INQUIRIES, label: '문의하기', icon: MessageSquare },
  { to: ROUTES.MY_NFTS, label: '내 포카', icon: Images },
  { to: ROUTES.MY, label: '마이', icon: UserRound },
] as const;

/** 가로 레일에 몇 장까지 실을지. 너무 많으면 끝까지 미는 사람이 없습니다. */
const RAIL_LIMIT = 8;

/**
 * 데스크톱에서 레일 한 화면에 들어갈 카드 수와, 거기서 나온 카드 폭.
 *
 * 폭을 먼저 정하면(예전 `lg:w-[10.5rem]`) 레일 폭과 딱 나눠떨어지지 않아
 * **맨 끝 카드가 반쯤 잘린 채** 걸립니다. 그래서 순서를 뒤집어, "다섯 장이 딱
 * 맞으려면 한 장이 몇 px 이어야 하나" 를 CSS 가 계산하게 둡니다.
 *
 * `100%` 는 트랙 폭(= 레일 폭)이고, 빼는 값은 카드 **사이** 간격의 총합입니다
 * (다섯 장이면 사이가 넷, `lg:gap-4` = 1rem × 4).
 *
 * ⚠️ 칸 수·간격 중 하나를 바꾸면 식의 두 숫자를 **같이** 고쳐야 합니다.
 *    어긋나면 다시 잘립니다.
 */
const RAIL_CARD_WIDTH = 'lg:w-[calc((100%-4rem)/5)]';

/**
 * 홈.
 *
 * ── 화면 순서 ─────────────────────────────────────────────
 *   헤더(서비스명 · 검색) → 캐러셀 → 바로가기 5칸 → 티켓팅 일정(가로 레일)
 *
 * ── 검정/하양 경계 구조 ────────────────────────────────────
 * 상단바와 배너 위쪽 90% 는 짙은 회검정, 배너 아래 10% 부터는 흰 배경입니다.
 * 배너가 검정에서 흰 영역으로 걸쳐 내려오면서 떠 있는 느낌을 만듭니다.
 *
 *   ┌───────────────┐
 *   │ ███ 검정 ████ │  상단바 (TEACAT · 검색)
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
  const activeHolds = useActiveHolds();
  const releaseHold = useReleaseMyHold();
  const { open } = useModal();

  /* 되돌릴 수 없습니다 — 놓으면 그 자리는 곧바로 남이 살 수 있습니다 (CLAUDE.md 4-7) */
  const askToRelease = (scheduleId: string, seatId: string) =>
    open('common/confirm', {
      title: '잡아둔 자리를 놓을까요?',
      message:
        '지금 자리가 풀리고 다른 사람이 살 수 있게 됩니다. 다시 잡으려면 처음부터 골라야 해요.',
      confirmText: '놓기',
      danger: true,
      onConfirm: () => releaseHold.mutate({ scheduleId, seatId }),
    });

  /**
   * 레일에 실을 공연 — **예매중·매진·오픈 예정을 한 줄에** 싣습니다.
   *
   * 예전에는 열린 공연이 하나라도 있으면 예정을 통째로 감췄습니다. 그래서 "다음에 뭐가
   * 열리지" 를 홈에서 알 수 없었는데, 티켓팅은 몇 분이고 그 사이는 몇 주라 예정이야말로
   * 사람들이 홈에 보러 오는 정보였습니다.
   *
   * 섞여도 헷갈리지 않는 것은 카드마다 상태 칩이 붙고(예매중·매진·오픈 예정),
   * **살 수 있는 것이 앞에 오도록** 정렬하기 때문입니다 (`compareForRail`).
   */
  const rail = (concerts ?? []).filter(isConcertOnRail).sort(compareForRail).slice(0, RAIL_LIMIT);

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

          높이는 `--banner-height` 가 lg 에서 2:1 로 다시 계산됩니다 (styles/index.css) */}
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
          <Skeleton className="aspect-[4/3] w-full rounded-lg lg:aspect-[2/1] lg:rounded-t-2xl lg:rounded-b-none" />
        ) : (
          banners && <BannerCarousel banners={banners} onSelect={openBanner} />
        )}
      </div>

      {/* ── 바로가기 ──
          폰에서는 배너 아래 한 칸 띄우고, **데스크톱에서는 배너에 이어 붙습니다**
          (`lg:pt-0` + 맞닿는 모서리만 각지게). 배너와 한 덩어리로 보이게 하려는 것이라
          위치를 CSS 로만 바꿉니다 — 화면마다 따로 그리면 둘이 갈라집니다.

          폰에서는 흰 타일 다섯 개가 오프화이트 바탕 위에 떠 있는 것으로 충분합니다
          (폭이 좁아 그 자체가 한 줄로 읽힙니다). 넓은 화면에서는 같은 타일이
          빈 벌판에 흩어진 점 다섯 개가 됩니다 — **하나의 면**으로 묶습니다.
          묶은 면이 흰색이므로 안쪽 타일은 흰색·그림자를 거둡니다.
          같은 층을 두 번 쌓으면 타일이 면에서 또 떠 보입니다. */}
      <div className="relative px-4 pt-6 lg:px-0 lg:pt-0">
        <Stagger
          as="ul"
          className="lg:bg-surface-1 lg:shadow-card grid grid-cols-5 gap-x-1.5 lg:gap-x-4 lg:rounded-b-2xl lg:px-8 lg:py-7"
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
      </div>

      {/* ── 흰 배경 영역 ── */}
      <div className="relative space-y-6 px-4 pt-6 lg:space-y-10 lg:px-0 lg:pt-10">
        {/* 시간이 걸린 일이라 얼굴 등록 안내보다 위입니다.
            🔴 **전부** 보여줍니다. 1인 1매는 회차 단위 제약이라 공연이 다르면 여러 자리를
               잡아둘 수 있는데, 예전에는 맨 앞 하나만 떠서 나머지는 돌아갈 길 없이
               10분간 묶여 있었습니다. */}
        {activeHolds.length > 0 && (
          <ul className="space-y-2">
            {activeHolds.map(({ hold, remainSeconds }) => (
              <li key={`${hold.scheduleId}:${hold.seatId}`}>
                <ResumeBookingCard
                  hold={hold}
                  remainSeconds={remainSeconds}
                  onContinue={() => navigate(ROUTES.BOOKING_REVIEW(hold.scheduleId))}
                  isReleasing={releaseHold.isPending}
                  onRelease={() => askToRelease(hold.scheduleId, hold.seatId)}
                />
              </li>
            ))}
          </ul>
        )}

        {/* 얼굴을 닫아 둔 배포에서는 `can.useTicket` 이 늘 true 라 이 안내가 사라집니다 */}
        {isLoggedIn && user && !can.useTicket(user) && (
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

        {/* 티켓팅 일정 — 세로로 쌓지 않고 옆으로 밉니다.
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
            {/* 예매중·매진·오픈 예정이 함께 있으므로 어느 한쪽을 가리키는 말을 쓰지 않습니다 */}
            티켓팅 일정
          </SectionTitle>

          {isPending ? (
            /* 홈은 페이지 일부라 화면 가운데로 밀지 않습니다 (min-h-0) */
            <Loading label="공연을 불러오는 중" className="min-h-0 py-8" />
          ) : rail.length === 0 ? (
            /* 여기까지 왔으면 열린 것도 예정도 없습니다 — 등록된 공연 자체가 없는 경우 */
            <p className="text-subtle py-8 text-center text-sm">아직 등록된 공연이 없어요.</p>
          ) : (
            /* 폰: -mx-4 로 화면 끝까지 흐르게 하고, 안쪽 px-4 로 첫/마지막 카드를 맞춥니다.
               그래야 옆에 다음 카드가 살짝 걸쳐 보여 "더 있다"는 게 읽힙니다.

               데스크톱: 카드가 **잘리지 않습니다.** 한 화면에 딱 다섯 장이 들어가도록
               카드 폭을 레일에서 거꾸로 계산합니다 (아래 `RAIL_COLUMNS`).
               자동 흐름은 여기서 끕니다 — 매 프레임 조금씩 미는 방식이라
               멈춰 있는 대부분의 순간에 카드가 반쯤 잘려 있습니다. 넘기는 건 화살표가 합니다. */
            <Rail label="티켓팅 일정" className="-mx-4 lg:mx-0">
              {/* 🔴 `lg:w-full` 이 핵심입니다. 폰에서는 `w-max`(내용만큼)라 카드가 넘쳐
                  흐르지만, 데스크톱에서는 트랙을 **레일 폭에 묶어** 둡니다. 그래야 아래
                  카드의 `100%` 가 레일 폭을 가리켜서 "다섯 장이 딱 맞는 폭"이 나옵니다.
                  (`w-max` 인 채로 %를 쓰면 폭이 내용에서 나오고 내용이 폭에서 나와 순환합니다)
                  카드는 `shrink-0` 이라 트랙 밖으로 넘쳐 흐르고, 스크롤은 그대로 됩니다. */}
              <ul className="flex w-max gap-3 px-4 pt-1 pb-2 lg:w-full lg:gap-4 lg:px-0">
                {rail.map((concert) => (
                  <li
                    key={concert.concertId}
                    className={cn('w-[8.5rem] shrink-0', RAIL_CARD_WIDTH)}
                  >
                    <motion.button
                      type="button"
                      onClick={() => navigate(ROUTES.CONCERT_DETAIL(String(concert.concertId)))}
                      whileTap={{ scale: 0.97 }}
                      className="w-full text-left"
                    >
                      {/* `RAIL_ANCHOR` — 화살표가 **포스터**의 세로 한가운데 앉습니다.
                          안 붙이면 제목·공연장 두 줄까지 포함한 레일 전체의 가운데라
                          화살표가 그림 아래로 처집니다. */}
                      <div className="relative" {...RAIL_ANCHOR}>
                        <PosterImage
                          src={concert.posterUrl}
                          seed={posterSeedOf(concert)}
                          alt={`${concert.title} 포스터`}
                          className="w-full"
                        />
                        {/* 붉은 LIVE 칩은 **지금 살 수 있을 때만** 입니다 (CLAUDE.md 4-6).
                            오픈 예정에 붉은 점을 달면 눌렀다가 못 사고 돌아옵니다. */}
                        <span className="absolute top-1.5 left-1.5">
                          {/* 🔴 칩은 **공연마다** 정합니다. 레일 전체로 정하면 매진된 공연에도
                              "예매중" 이 붙어서, 눌렀다가 못 사고 돌아옵니다 */}
                          {isConcertOpen(concert) ? (
                            <Badge tone="live" icon={<LiveDot />} className="shadow-card">
                              {CONCERT_BOOKING_LABEL.OPEN}
                            </Badge>
                          ) : (
                            <Badge tone="neutral" className="shadow-card">
                              {CONCERT_BOOKING_LABEL[concert.bookingStatus]}
                            </Badge>
                          )}
                        </span>
                      </div>

                      <p className="mt-2 truncate text-[0.875rem] font-bold">{concert.title}</p>
                      {/* 예정 카드에서 가장 궁금한 건 장소가 아니라 **언제 열리나** 입니다.
                          🔴 **공연마다** 정합니다 — 레일 전체로 정하면 한 줄에 섞여 있는 지금
                          예정 카드에도 공연장이 뜨거나, 예매중 카드에 오픈 시각이 뜹니다 */}
                      <p className="text-ink-muted truncate text-[0.8125rem]">
                        {concert.bookingStatus === 'BEFORE'
                          ? `${formatDateTime(concert.ticketingStartAt)} 오픈`
                          : concert.stadiumName}
                      </p>
                    </motion.button>
                  </li>
                ))}
              </ul>
            </Rail>
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
