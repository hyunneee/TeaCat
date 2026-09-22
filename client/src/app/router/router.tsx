import { createElement, lazy, type ComponentType, type ReactNode } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { wrapCreateBrowserRouter } from '@sentry/react';
import { FEATURE, ROUTES } from '@/shared/constants';
import { IS_DEV_BUILD } from '@/shared/config';
import { AppLayout, PlainLayout, SearchLayout, DetailLayout } from '@/shared/components/layout';
import { RouteBoundary } from '@/shared/components/common';
/* 🔴 페이지가 아니라 **머리말 조각**이라 lazy 로 나누지 않습니다. 상단 내비와 함께 첫 화면에
   그려지므로 쪼개면 잔액 자리만 늦게 채워져 머리말이 한 번 움직입니다. */
import { CatMoneyChip } from '@/features/token';
import { RequireAuth, RequireFace, RequireCaptcha, RequireQueue, RequireRole } from './guards';
import { RequireBookingAccess } from './RequireBookingAccess';

/* 페이지는 전부 lazy 로 나눕니다.
   티켓팅 오픈 순간의 첫 진입 속도가 곧 전환율입니다.
   NFT 마켓/모니터링 코드까지 첫 로딩에 받게 하지 마세요. */
const page = <T extends Record<string, unknown>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(() => loader().then((m) => ({ default: m[name] as ComponentType })));

const HomePage = page(() => import('@/pages/HomePage'), 'HomePage');
const LoginPage = page(() => import('@/pages/LoginPage'), 'LoginPage');
const SignupPage = page(() => import('@/pages/SignupPage'), 'SignupPage');
const SignupDonePage = page(() => import('@/pages/SignupDonePage'), 'SignupDonePage');
const FaceRegisterPage = page(() => import('@/pages/FaceRegisterPage'), 'FaceRegisterPage');
const FaceDonePage = page(() => import('@/pages/FaceDonePage'), 'FaceDonePage');

const SearchPage = page(() => import('@/pages/SearchPage'), 'SearchPage');

const ConcertListPage = page(() => import('@/pages/ConcertListPage'), 'ConcertListPage');
const ConcertDetailPage = page(() => import('@/pages/ConcertDetailPage'), 'ConcertDetailPage');

const BookingVerifyPage = page(() => import('@/pages/BookingVerifyPage'), 'BookingVerifyPage');
const QueueWaitingPage = page(() => import('@/pages/QueueWaitingPage'), 'QueueWaitingPage');
const SectionSelectPage = page(() => import('@/pages/SectionSelectPage'), 'SectionSelectPage');
const SeatSelectPage = page(() => import('@/pages/SeatSelectPage'), 'SeatSelectPage');
const BookingReviewPage = page(() => import('@/pages/BookingReviewPage'), 'BookingReviewPage');
const PaymentPage = page(() => import('@/pages/PaymentPage'), 'PaymentPage');
const PaymentResultPage = page(() => import('@/pages/PaymentResultPage'), 'PaymentResultPage');
const BookingDonePage = page(() => import('@/pages/BookingDonePage'), 'BookingDonePage');

const ResalePage = page(() => import('@/pages/ResalePage'), 'ResalePage');
const MyResalePage = page(() => import('@/pages/MyResalePage'), 'MyResalePage');

const MyTicketsPage = page(() => import('@/pages/MyTicketsPage'), 'MyTicketsPage');
const TicketDetailPage = page(() => import('@/pages/TicketDetailPage'), 'TicketDetailPage');

const NftMarketPage = page(() => import('@/pages/NftMarketPage'), 'NftMarketPage');
const NftDetailPage = page(() => import('@/pages/NftDetailPage'), 'NftDetailPage');
const PocaPackClaimPage = page(() => import('@/pages/PocaPackClaimPage'), 'PocaPackClaimPage');
const PocaDrawPage = page(() => import('@/pages/PocaDrawPage'), 'PocaDrawPage');
const AuctionDetailPage = page(() => import('@/pages/AuctionDetailPage'), 'AuctionDetailPage');
const MyAuctionsPage = page(() => import('@/pages/MyAuctionsPage'), 'MyAuctionsPage');
const MyBidsPage = page(() => import('@/pages/MyBidsPage'), 'MyBidsPage');
const MyNftsPage = page(() => import('@/pages/MyNftsPage'), 'MyNftsPage');
const StickerCreatePage = page(() => import('@/pages/StickerCreatePage'), 'StickerCreatePage');
const MyStickersPage = page(() => import('@/pages/MyStickersPage'), 'MyStickersPage');
const NftTradesPage = page(() => import('@/pages/NftTradesPage'), 'NftTradesPage');
const NftSalesPage = page(() => import('@/pages/NftSalesPage'), 'NftSalesPage');
const TokenPage = page(() => import('@/pages/TokenPage'), 'TokenPage');
const TokenGamePage = page(() => import('@/pages/TokenGamePage'), 'TokenGamePage');
const SongpyeonGamePage = page(() => import('@/pages/SongpyeonGamePage'), 'SongpyeonGamePage');

const MyPage = page(() => import('@/pages/MyPage'), 'MyPage');
const SettingsPage = page(() => import('@/pages/SettingsPage'), 'SettingsPage');
const PasswordChangePage = page(() => import('@/pages/PasswordChangePage'), 'PasswordChangePage');
const NicknameChangePage = page(() => import('@/pages/NicknameChangePage'), 'NicknameChangePage');
const AboutPage = page(() => import('@/pages/AboutPage'), 'AboutPage');
const PrivacyPolicyPage = page(() => import('@/pages/PrivacyPolicyPage'), 'PrivacyPolicyPage');

const OauthCallbackPage = page(() => import('@/pages/OauthCallbackPage'), 'OauthCallbackPage');
const OauthSignupPage = page(() => import('@/pages/OauthSignupPage'), 'OauthSignupPage');

const MonitoringPage = page(() => import('@/pages/MonitoringPage'), 'MonitoringPage');
const AdminStadiumPage = page(() => import('@/pages/AdminStadiumPage'), 'AdminStadiumPage');
const AdminStadiumListPage = page(
  () => import('@/pages/AdminStadiumListPage'),
  'AdminStadiumListPage',
);
const AdminStadiumDetailPage = page(
  () => import('@/pages/AdminStadiumDetailPage'),
  'AdminStadiumDetailPage',
);
const NotFoundPage = page(() => import('@/pages/NotFoundPage'), 'NotFoundPage');

/* 어드민 대시보드. 껍데기까지 lazy 로 쪼갭니다 —
   일반 사용자는 평생 이 코드를 받지 않습니다. */
const AdminLayout = page(() => import('@/features/admin'), 'AdminLayout');
const AdminDashboardPage = page(() => import('@/pages/AdminDashboardPage'), 'AdminDashboardPage');
const AdminUsersPage = page(() => import('@/pages/AdminUsersPage'), 'AdminUsersPage');
const AdminCheckInPage = page(() => import('@/pages/AdminCheckInPage'), 'AdminCheckInPage');
const AdminSeatAttendeesPage = page(
  () => import('@/pages/AdminSeatAttendeesPage'),
  'AdminSeatAttendeesPage',
);
const AdminUserDetailPage = page(
  () => import('@/pages/AdminUserDetailPage'),
  'AdminUserDetailPage',
);
const AdminBannersPage = page(() => import('@/pages/AdminBannersPage'), 'AdminBannersPage');
const AdminTradeReviewsPage = page(
  () => import('@/pages/AdminTradeReviewsPage'),
  'AdminTradeReviewsPage',
);
const AdminPackEventsPage = page(
  () => import('@/pages/AdminPackEventsPage'),
  'AdminPackEventsPage',
);
const AdminPocaDesignsPage = page(
  () => import('@/pages/AdminPocaDesignsPage'),
  'AdminPocaDesignsPage',
);
const AdminPocaTemplatesPage = page(
  () => import('@/pages/AdminPocaTemplatesPage'),
  'AdminPocaTemplatesPage',
);
const AdminPerformanceDrawPoolPage = page(
  () => import('@/pages/AdminPerformanceDrawPoolPage'),
  'AdminPerformanceDrawPoolPage',
);
const AdminAnalyticsPage = page(() => import('@/pages/AdminAnalyticsPage'), 'AdminAnalyticsPage');
const AdminConcertsPage = page(() => import('@/pages/AdminConcertsPage'), 'AdminConcertsPage');
const AdminConcertCreatePage = page(
  () => import('@/pages/AdminConcertCreatePage'),
  'AdminConcertCreatePage',
);
const AdminConcertEditPage = page(
  () => import('@/pages/AdminConcertEditPage'),
  'AdminConcertEditPage',
);
const AdminInquiriesPage = page(() => import('@/pages/AdminInquiriesPage'), 'AdminInquiriesPage');

const InquiryListPage = page(() => import('@/pages/InquiryListPage'), 'InquiryListPage');
const InquiryWritePage = page(() => import('@/pages/InquiryWritePage'), 'InquiryWritePage');
const InquiryDetailPage = page(() => import('@/pages/InquiryDetailPage'), 'InquiryDetailPage');

/**
 * 첫 화면이 그려진 뒤 **한가할 때** 미리 받아 두는 화면들.
 *
 * 페이지를 lazy 로 쪼갠 이유는 첫 진입을 가볍게 하려는 것이지, 이동할 때마다
 * 기다리게 하려는 게 아닙니다. 코드 조각이 아직 없으면 이동하는 순간
 * 화면이 **비었다가**(로딩) 채워져서, 특히 휴대폰에서 흰 화면이 깜빡이는 것처럼 보입니다.
 *
 * 그래서 **첫 페인트 뒤 유휴 시간에** 자주 가는 화면만 먼저 받아 둡니다.
 * 첫 진입 속도는 그대로고(이미 화면은 그려진 뒤), 두 번째 이동부터 대기가 사라집니다.
 * ⚠️ 여기에 무거운 화면(얼굴 등록·좌석맵)을 넣지 마세요 — 안 갈 사람의 데이터를 태웁니다.
 */
const WARM_ROUTES = [
  () => import('@/pages/ConcertListPage'),
  () => import('@/pages/ConcertDetailPage'),
  () => import('@/pages/NftDetailPage'),
  () => import('@/pages/MyTicketsPage'),
  () => import('@/pages/MyPage'),
];

export function warmRoutes() {
  const run = () => {
    /* 실패는 무시합니다 — 미리 받기는 편의일 뿐이고,
       실제 이동할 때 lazy 가 다시 받습니다. */
    for (const load of WARM_ROUTES) void load().catch(() => undefined);
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 3000 });
  } else {
    // 사파리에는 requestIdleCallback 이 없습니다 (17.4 이전)
    setTimeout(run, 1200);
  }
}

/** lazy 페이지를 Suspense + ErrorBoundary 로 감싸는 헬퍼.
    경로가 바뀌면 에러 상태가 자동으로 풀립니다. */
const withBoundary = (element: ReactNode) => <RouteBoundary>{element}</RouteBoundary>;

/**
 * 🔴 이 화면은 Microsoft Clarity 리플레이에 **내용이 찍히지 않습니다.**
 *
 * 감싼 노드와 그 자식의 텍스트·이미지는 마스킹돼 서버로 가지 않습니다
 * (클릭 위치·횟수는 그대로 올라가서 히트맵·rage click 은 영향 없습니다).
 *
 * ── 어떤 화면에 붙이나 ──────────────────────────────────
 * 화면에 **사람을 특정할 수 있는 값**이 뜨면 붙입니다 —
 * 이메일·전화번호·닉네임·주소·티켓/주문 정보·결제 내역·문의 본문.
 * 남의 데이터를 보는 운영 화면(`/admin`)도 포함입니다.
 *
 * 반대로 예매 흐름의 **좌석·구역 선택은 일부러 열어 둡니다.** 거기가 Clarity 를
 * 붙인 이유(선점 실패 후 연타·못 누르는 좌석)이고, 개인정보가 뜨지 않습니다.
 *
 * 🔴 **새 화면을 만들 때 판단해서 붙이는 건 사람 몫입니다.** 예전에는
 *    `index.html` 이 전부 가리는 기본 차단이라 아무것도 안 해도 안전했는데,
 *    선택적으로 바꾸면서 그 보호가 없어졌습니다. 빠뜨리면 조용히 노출됩니다.
 *
 * 🔴 **포탈로 띄우는 모달은 이게 닿지 않습니다.** `#modal-root` 가 `#root` 의
 *    자식이 아니라서, 감싼 화면 안에서 연 모달의 내용은 리플레이에 남습니다.
 *    민감한 값을 모달에 띄운다면 그 컴포넌트에 `data-clarity-mask="true"` 를
 *    직접 붙이세요. (CLAUDE.md 7장 "행동 분석")
 *
 * `contents` 는 이 `div` 가 레이아웃 상자를 만들지 않게 합니다 — 자식이 부모의
 * flex/grid 에 그대로 참여하므로 감싸도 화면이 틀어지지 않습니다.
 */
const withMask = (element: ReactNode) => (
  <div className="contents" data-clarity-mask="true">
    {element}
  </div>
);

/**
 * 🛠 개발 전용 라우트.
 *
 * `import()` 를 **조건 안에** 둬야 합니다. 밖에 두면 라우트를 등록하지 않아도
 * Vite 가 청크를 만들어 운영 번들에 실어 보냅니다(닿지 않는 죽은 코드).
 * `IS_DEV_BUILD` 는 빌드 시점 리터럴이라 운영에서는 이 블록이 통째로 사라집니다.
 */
const devRoutes: RouteObject[] = IS_DEV_BUILD
  ? [
      {
        path: ROUTES.DEV_FACE,
        element: withBoundary(
          createElement(page(() => import('@/pages/DevFacePage'), 'DevFacePage')),
        ),
      },
      /* 포카 꾸미기 그림판을 로그인 없이 봅니다 — 백엔드가 안 닿는 곳에서 화면 작업용.
         본 라우트(`STICKER_CREATE`)는 RequireAuth 안에 있고 그쪽이 진짜 길입니다. */
      {
        path: ROUTES.DEV_STICKER,
        element: withBoundary(<StickerCreatePage />),
      },
      { path: ROUTES.DEV_MY_STICKERS, element: withBoundary(<MyStickersPage />) },
    ]
  : [];

const routes: RouteObject[] = [
  /* ══ 어드민 대시보드 (데스크톱 전용) ═══════════════════════
     🔴 앱 레이아웃(AppLayout / PlainLayout)을 쓰지 않습니다. `.app-width`
        한 기둥이 아니라 화면을 꽉 쓰는 사이드바 + 본문 구조입니다.
        (client/CLAUDE.md 8장)

     가드가 두 겹입니다.
       RequireAuth  — 비로그인은 로그인 화면으로 (원래 가려던 곳을 기억)
       RequireRole  — 일반 회원(USER)은 홈으로 되돌려보냄
     회원 관리는 서버가 ADMIN 전용이라 한 겹 더 좁힙니다.

     🔴 메뉴를 추가할 때는 여기 자식 라우트 + AdminSidebar 의 ADMIN_MENU
        두 곳만 손대면 됩니다. */
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireRole roles={['ADMIN', 'STADIUM', 'PERFORMANCE']} />,
        children: [
          {
            path: ROUTES.ADMIN,
            element: withMask(<AdminLayout />),
            children: [
              { index: true, element: withBoundary(<AdminDashboardPage />) },
              {
                element: <RequireRole roles={['ADMIN', 'STADIUM']} />,
                children: [
                  { path: ROUTES.ADMIN_STADIUM, element: withBoundary(<AdminStadiumPage />) },
                  { path: ROUTES.ADMIN_STADIUMS, element: withBoundary(<AdminStadiumListPage />) },
                  {
                    path: ROUTES.ADMIN_STADIUM_DETAIL(':stadiumId'),
                    element: withBoundary(<AdminStadiumDetailPage />),
                  },
                ],
              },
              {
                /* 공연 관리는 서버가 ADMIN 과 공연 주최자(PERFORMANCE)에게 열어 둔다
                   (SecurityConfig 의 /admin/concerts/**). 보이는 범위는 다르다 —
                   ADMIN 은 전체, PERFORMANCE 는 본인이 등록한 것만
                   (useManagedConcerts 가 부르는 API 를 나눈다). */
                element: <RequireRole roles={['ADMIN', 'PERFORMANCE']} />,
                children: [
                  { path: ROUTES.ADMIN_CONCERTS, element: withBoundary(<AdminConcertsPage />) },
                  { path: ROUTES.ADMIN_CHECK_IN, element: withBoundary(<AdminCheckInPage />) },
                  {
                    /* 예매자 이름·연락처가 뜨는 화면입니다. 마스킹은 위 AdminLayout 의
                       `withMask` 가 이미 덮습니다 — 행동 분석에 명단이 수집되지 않게. */
                    path: ROUTES.ADMIN_SEAT_ATTENDEES,
                    element: withBoundary(<AdminSeatAttendeesPage />),
                  },
                  {
                    path: ROUTES.ADMIN_CONCERT_DRAW_POOL(':concertId'),
                    element: withBoundary(<AdminPerformanceDrawPoolPage />),
                  },
                  {
                    /* 정적 경로가 `:concertId` 보다 먼저 와야 'new' 를 ID 로 읽지 않는다 */
                    path: ROUTES.ADMIN_CONCERT_CREATE,
                    element: withBoundary(<AdminConcertCreatePage />),
                  },
                  {
                    path: ROUTES.ADMIN_CONCERT_EDIT(':concertId'),
                    element: withBoundary(<AdminConcertEditPage />),
                  },
                ],
              },
              {
                /* 회원 관리는 서버가 ADMIN 전용이다. STADIUM·PERFORMANCE 는
                   대시보드까지만 들어오고 여기서 홈으로 되돌려보낸다. */
                element: <RequireRole roles={['ADMIN']} />,
                children: [
                  { path: ROUTES.ADMIN_USERS, element: withBoundary(<AdminUsersPage />) },
                  { path: ROUTES.MONITORING, element: withBoundary(<MonitoringPage />) },

                  {
                    /* 개인정보 마스킹은 위 AdminLayout 의 withMask 가 이미 덮습니다 */
                    path: ROUTES.ADMIN_USER_DETAIL(':userId'),
                    element: withBoundary(<AdminUserDetailPage />),
                  },
                  { path: ROUTES.ADMIN_INQUIRIES, element: withBoundary(<AdminInquiriesPage />) },
                  {
                    path: ROUTES.ADMIN_TRADE_REVIEWS,
                    element: withBoundary(<AdminTradeReviewsPage />),
                  },
                  { path: ROUTES.ADMIN_BANNERS, element: withBoundary(<AdminBannersPage />) },
                  {
                    path: ROUTES.ADMIN_POCA_TEMPLATES,
                    element: withBoundary(<AdminPocaTemplatesPage />),
                  },
                  {
                    path: ROUTES.ADMIN_PACK_EVENTS,
                    element: withBoundary(<AdminPackEventsPage />),
                  },
                  {
                    path: ROUTES.ADMIN_POCA_DESIGNS,
                    element: withBoundary(<AdminPocaDesignsPage />),
                  },

                  { path: ROUTES.ADMIN_ANALYTICS, element: withBoundary(<AdminAnalyticsPage />) },
                ],
              },
              /* 모니터링(/admin/monitoring)은 아직 앱(모바일) 레이아웃에 있습니다.
                 이 콘솔로 옮길 때 위 자식으로 내리고 AdminSidebar 에 메뉴를 넣으세요. */
            ],
          },
        ],
      },
    ],
  },

  /* ══ 하단 탭이 보이는 화면 ═══════════════════════════════ */
  {
    /* 캣머니 칩은 `features/token` 것이고 AppLayout·TopNav 는 `shared` 라 서로를 모릅니다.
       두 쪽을 다 아는 자리가 여기(app 레이어)라 여기서 끼워 넣습니다 (CLAUDE.md 3-2). */
    element: <AppLayout navAction={<CatMoneyChip />} />,
    children: [
      { path: ROUTES.HOME, element: withBoundary(<HomePage />) },
      { path: ROUTES.CONCERTS, element: withBoundary(<ConcertListPage />) },
      /* 공연 등록·수정은 어드민 콘솔(/admin/concerts)에 있습니다.
         여기 앱 화면에도 같은 기능이 한 벌 더 있었는데, 관람객 화면에 관리 기능이 섞여
         있었고 화면이 두 벌이라 한쪽만 고치면 어긋났습니다. */
      { path: ROUTES.CONCERT_DETAIL(':concertId'), element: withBoundary(<ConcertDetailPage />) },
      { path: ROUTES.NFT_MARKET, element: withBoundary(<NftMarketPage />) },

      {
        element: <RequireAuth />,
        children: [
          { path: ROUTES.MY, element: withMask(withBoundary(<MyPage />)) },
          { path: ROUTES.MY_TICKETS, element: withMask(withBoundary(<MyTicketsPage />)) },
          { path: ROUTES.MY_RESALE, element: withBoundary(<MyResalePage />) },
          { path: ROUTES.MY_NFTS, element: withBoundary(<MyNftsPage />) },
          /* 캣치 — 하단 탭의 목적지라 탭이 보이는 레이아웃에 있어야 합니다.
             게임 화면(/token/game·/token/songpyeon)은 전체화면이라 PlainLayout 에 그대로 둡니다. */
          { path: ROUTES.TOKEN, element: withBoundary(<TokenPage />) },
        ],
      },
    ],
  },

  /* 모바일은 전체화면 검색, 데스크톱은 공통 상단 내비를 유지합니다. */
  {
    element: <SearchLayout />,
    children: [{ path: ROUTES.SEARCH, element: withBoundary(<SearchPage />) }],
  },

  {
    element: <DetailLayout />,
    children: [
      { path: ROUTES.NFT_DETAIL(':photocardId'), element: withBoundary(<NftDetailPage />) },
      { path: ROUTES.AUCTION_DETAIL(':auctionId'), element: withBoundary(<AuctionDetailPage />) },
      {
        element: <RequireAuth />,
        children: [
          {
            path: ROUTES.TICKET_DETAIL(':ticketId'),
            element: withMask(withBoundary(<TicketDetailPage />)),
          },
          { path: ROUTES.MY_BIDS, element: withBoundary(<MyBidsPage />) },
          { path: ROUTES.MY_NFT_TRADES, element: withBoundary(<NftTradesPage />) },
          { path: ROUTES.MY_NFT_SALES, element: withMask(withBoundary(<NftSalesPage />)) },
          { path: ROUTES.MY_AUCTIONS, element: withBoundary(<MyAuctionsPage />) },

          { path: ROUTES.MY_INQUIRIES, element: withMask(withBoundary(<InquiryListPage />)) },
          { path: ROUTES.MY_INQUIRY_NEW, element: withMask(withBoundary(<InquiryWritePage />)) },
          {
            path: '/my/inquiries/:inquiryId',
            element: withMask(withBoundary(<InquiryDetailPage />)),
          },
          {
            path: '/my/inquiries/:inquiryId/edit',
            element: withMask(withBoundary(<InquiryWritePage />)),
          },
        ],
      },
    ],
  },

  /* ══ 전체화면 (하단 탭 없음) ═════════════════════════════ */
  {
    element: <PlainLayout />,
    children: [
      { path: ROUTES.LOGIN, element: withMask(withBoundary(<LoginPage />)) },
      { path: ROUTES.SIGNUP, element: withMask(withBoundary(<SignupPage />)) },
      { path: ROUTES.SIGNUP_DONE, element: withMask(withBoundary(<SignupDonePage />)) },

      /* SSAFY 로그인 복귀 지점. 아직 세션이 없는 상태로 들어오므로 가드 밖에 둡니다. */
      { path: ROUTES.OAUTH_CALLBACK, element: withMask(withBoundary(<OauthCallbackPage />)) },
      { path: ROUTES.OAUTH_SIGNUP, element: withMask(withBoundary(<OauthSignupPage />)) },

      {
        element: <RequireAuth />,
        children: [
          /* ── 얼굴 (등록·완료·본인확인) ──────────────────────
             🔴 1차 배포에서는 **길을 아예 내지 않습니다** (`FEATURE.face`).
                화면·훅·모델 파일은 그대로 두고 여기서만 빼므로, 되살릴 때는
                `shared/constants/features.ts` 의 값 하나만 바꾸면 됩니다.
                마스킹은 얼굴·판정 결과가 뜨는 화면이라 계속 필요합니다. */
          ...(FEATURE.face
            ? [
                {
                  path: ROUTES.FACE_REGISTER,
                  element: withMask(withBoundary(<FaceRegisterPage />)),
                },
                { path: ROUTES.FACE_DONE, element: withMask(withBoundary(<FaceDonePage />)) },
              ]
            : []),
          /* 뽑은 카드는 내 것이 되므로 로그인이 필요합니다 */
          { path: ROUTES.NFT_PACK_CLAIM, element: withBoundary(<PocaPackClaimPage />) },
          { path: ROUTES.NFT_DRAW, element: withBoundary(<PocaDrawPage />) },
          { path: ROUTES.TOKEN_GAME, element: withBoundary(<TokenGamePage />) },
          { path: ROUTES.TOKEN_SONGPYEON, element: withBoundary(<SongpyeonGamePage />) },


          /* ── AI 스티커 (포카 꾸미기) ── `FEATURE.sticker` 가 꺼지면 길이 없습니다.
             그리기 화면은 사람을 특정하는 값이 없어 `withMask` 를 붙이지 않습니다. */
          ...(FEATURE.sticker
            ? [
                { path: ROUTES.STICKER_CREATE, element: withBoundary(<StickerCreatePage />) },
                /* 내가 만든 것들 — 내 데이터라 withMask */
                { path: ROUTES.MY_STICKERS, element: withMask(withBoundary(<MyStickersPage />)) },
              ]
            : []),

          { path: ROUTES.SETTINGS, element: withMask(withBoundary(<SettingsPage />)) },
          {
            path: ROUTES.SETTINGS_PASSWORD,
            element: withMask(withBoundary(<PasswordChangePage />)),
          },
          {
            path: ROUTES.SETTINGS_NICKNAME,
            element: withMask(withBoundary(<NicknameChangePage />)),
          },
          { path: ROUTES.SETTINGS_ABOUT, element: withBoundary(<AboutPage />) },

          /* 문의 — 목록·작성·상세. 로그인한 회원 본인 것만 봅니다 */

          /* 결제창(모바일 리디렉션)에서 돌아오는 곳.
             ⚠️ 일부러 RequireFace / RequireCaptcha **밖**에 둡니다.
             결제는 이미 끝난 상태인데 가드에 막히면 승인 요청을 못 보내
             "돈은 빠졌는데 티켓이 없는" 사고가 납니다. */
          {
            path: ROUTES.BOOKING_PAYMENT_RESULT(':scheduleId'),
            element: withMask(withBoundary(<PaymentResultPage />)),
          },

          /* 예매 완료 화면도 같은 이유로 가드 밖입니다.
             결제·발권이 끝난 뒤에 보여주는 화면인데 여기서 튕기면
             티켓은 발급됐는데 사용자는 실패한 줄 압니다.
             (이 화면은 얼굴 미등록 사용자에게 등록을 안내하는 역할도 합니다) */
          {
            path: ROUTES.BOOKING_DONE(':orderId'),
            element: withMask(withBoundary(<BookingDonePage />)),
          },

          /* ── 예매 플로우 ──────────────────────────────────
             봇 확인 → 대기실 → 구역 → 좌석 → 확인 → 결제 → 완료
             얼굴 등록(RequireFace)은 예매 진입 조건,
             봇 확인 통과(RequireCaptcha)는 대기실부터의 조건,
             대기실 입장(RequireQueue)은 구역 선택부터의 조건입니다.
             봇 확인·대기실·구역·좌석은 RequireBookingAccess로 종료 회차의 직접 진입을 막습니다.
             확인·결제는 기존 선점 처리 흐름이므로 이 상태 가드 밖에 둡니다.
             대기실 화면 자체는 RequireQueue 밖에 있어야 합니다 — 안에 두면 입장 전 사용자가
             대기실로 보내지고, 대기실이 다시 자기 자신으로 보내는 고리가 됩니다. */
          {
            element: <RequireFace />,
            children: [
              { path: ROUTES.RESALE(':scheduleId'), element: withBoundary(<ResalePage />) },
              {
                element: withBoundary(<RequireBookingAccess />),
                children: [
                  {
                    path: ROUTES.BOOKING_VERIFY(':scheduleId'),
                    element: withBoundary(<BookingVerifyPage />),
                  },
                  {
                    element: <RequireCaptcha />,
                    children: [
                      {
                        path: ROUTES.BOOKING_WAITING(':scheduleId'),
                        element: withBoundary(<QueueWaitingPage />),
                      },
                      {
                        element: <RequireQueue />,
                        children: [
                          {
                            path: ROUTES.BOOKING_SECTION(':scheduleId'),
                            element: withBoundary(<SectionSelectPage />),
                          },
                          {
                            path: ROUTES.BOOKING_SEATS(':scheduleId'),
                            element: withBoundary(<SeatSelectPage />),
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                element: <RequireCaptcha />,
                children: [
                  {
                    element: <RequireQueue />,
                    children: [
                      {
                        path: ROUTES.BOOKING_REVIEW(':scheduleId'),
                        element: withMask(withBoundary(<BookingReviewPage />)),
                      },
                      {
                        path: ROUTES.BOOKING_PAYMENT(':scheduleId'),
                        element: withMask(withBoundary(<PaymentPage />)),
                      },
                    ],
                  },
                ],
              },
            ],
          },

          /* ── 운영 ── */

        ],
      },

      ...devRoutes,

      /* 개인정보처리방침 — 가드 밖입니다. 쿠키 동의 배너에서 링크로 걸리는데
         동의는 비로그인 첫 방문자에게도 물어야 하기 때문입니다.
         `withMask` 는 붙이지 않습니다 — 남의 개인정보가 아니라 고지문입니다. */
      { path: ROUTES.PRIVACY, element: withBoundary(<PrivacyPolicyPage />) },

      { path: ROUTES.NOT_FOUND, element: withBoundary(<NotFoundPage />) },
    ],
  },
];

/* Sentry 가 라우트를 알아보게 감쌉니다.
   이게 없으면 성능 지표가 `/concerts/1`, `/concerts/2` … 로 흩어져서
   "공연 상세가 느리다" 를 볼 수 없습니다 (`/concerts/:id` 하나로 묶임).
   Sentry 가 꺼져 있으면 감싼 함수가 원본을 그대로 부릅니다. */
export const router = wrapCreateBrowserRouter(createBrowserRouter)(routes);
