import { createElement, lazy, type ComponentType, type ReactNode } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { ROUTES } from '@/shared/constants';
import { IS_DEV_BUILD } from '@/shared/config';
import { AppLayout, PlainLayout } from '@/shared/components/layout';
import { RouteBoundary } from '@/shared/components/common';
import { RequireAuth, RequireFace, RequireCaptcha, RequireRole } from './guards';

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
const ConcertCreatePage = page(() => import('@/pages/ConcertCreatePage'), 'ConcertCreatePage');
const ConcertEditPage = page(() => import('@/pages/ConcertEditPage'), 'ConcertEditPage');

const BookingVerifyPage = page(
  () => import('@/pages/BookingVerifyPage'),
  'BookingVerifyPage',
);
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
const MyNftsPage = page(() => import('@/pages/MyNftsPage'), 'MyNftsPage');
const NftTradesPage = page(() => import('@/pages/NftTradesPage'), 'NftTradesPage');
const TokenPage = page(() => import('@/pages/TokenPage'), 'TokenPage');

const MyPage = page(() => import('@/pages/MyPage'), 'MyPage');
const SettingsPage = page(() => import('@/pages/SettingsPage'), 'SettingsPage');
const PasswordChangePage = page(
  () => import('@/pages/PasswordChangePage'),
  'PasswordChangePage',
);
const NicknameChangePage = page(
  () => import('@/pages/NicknameChangePage'),
  'NicknameChangePage',
);
const AboutPage = page(() => import('@/pages/AboutPage'), 'AboutPage');

const OauthCallbackPage = page(
  () => import('@/pages/OauthCallbackPage'),
  'OauthCallbackPage',
);
const OauthSignupPage = page(() => import('@/pages/OauthSignupPage'), 'OauthSignupPage');

const MonitoringPage = page(() => import('@/pages/MonitoringPage'), 'MonitoringPage');
const AdminStadiumPage = page(() => import('@/pages/AdminStadiumPage'), 'AdminStadiumPage');
const AdminStadiumListPage = page(
  () => import('@/pages/AdminStadiumListPage'),
  'AdminStadiumListPage',
);
const NotFoundPage = page(() => import('@/pages/NotFoundPage'), 'NotFoundPage');

/* 어드민 대시보드. 껍데기까지 lazy 로 쪼갭니다 —
   일반 사용자는 평생 이 코드를 받지 않습니다. */
const AdminLayout = page(() => import('@/features/admin'), 'AdminLayout');
const AdminDashboardPage = page(
  () => import('@/pages/AdminDashboardPage'),
  'AdminDashboardPage',
);
const AdminUsersPage = page(() => import('@/pages/AdminUsersPage'), 'AdminUsersPage');

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
  () => import('@/pages/NftMarketPage'),
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
        element: withBoundary(createElement(page(() => import('@/pages/DevFacePage'), 'DevFacePage'))),
      },
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
            element: <AdminLayout />,
            children: [
              { index: true, element: withBoundary(<AdminDashboardPage />) },
              {
                element: <RequireRole roles={['ADMIN', 'STADIUM']} />,
                children: [
                  { path: ROUTES.ADMIN_STADIUM, element: withBoundary(<AdminStadiumPage />) },
                  { path: ROUTES.ADMIN_STADIUMS, element: withBoundary(<AdminStadiumListPage />) },
                ],
              },
              {
                /* 회원 관리는 서버가 ADMIN 전용이다. STADIUM·PERFORMANCE 는
                   대시보드까지만 들어오고 여기서 홈으로 되돌려보낸다. */
                element: <RequireRole roles={['ADMIN']} />,
                children: [
                  { path: ROUTES.ADMIN_USERS, element: withBoundary(<AdminUsersPage />) },
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
    element: <AppLayout />,
    children: [
      { path: ROUTES.HOME, element: withBoundary(<HomePage />) },
      { path: ROUTES.CONCERTS, element: withBoundary(<ConcertListPage />) },
      /* 공연 등록·수정 — 관리자와 공연 주최자. 서버 /admin/concerts/** 가 받는 역할과 같습니다 */
      {
        element: <RequireRole roles={['ADMIN', 'PERFORMANCE']} />,
        children: [
          { path: ROUTES.CONCERT_CREATE, element: withBoundary(<ConcertCreatePage />) },
          { path: ROUTES.CONCERT_EDIT(':concertId'), element: withBoundary(<ConcertEditPage />) },
        ],
      },
      { path: ROUTES.CONCERT_DETAIL(':concertId'), element: withBoundary(<ConcertDetailPage />) },
      { path: ROUTES.NFT_MARKET, element: withBoundary(<NftMarketPage />) },

      {
        element: <RequireAuth />,
        children: [
          { path: ROUTES.MY, element: withBoundary(<MyPage />) },
          { path: ROUTES.MY_TICKETS, element: withBoundary(<MyTicketsPage />) },
        ],
      },
    ],
  },

  /* ══ 전체화면 (하단 탭 없음) ═════════════════════════════ */
  {
    element: <PlainLayout />,
    children: [
      { path: ROUTES.LOGIN, element: withBoundary(<LoginPage />) },
      { path: ROUTES.SIGNUP, element: withBoundary(<SignupPage />) },
      { path: ROUTES.SIGNUP_DONE, element: withBoundary(<SignupDonePage />) },

      /* SSAFY 로그인 복귀 지점. 아직 세션이 없는 상태로 들어오므로 가드 밖에 둡니다. */
      { path: ROUTES.OAUTH_CALLBACK, element: withBoundary(<OauthCallbackPage />) },
      { path: ROUTES.OAUTH_SIGNUP, element: withBoundary(<OauthSignupPage />) },
      { path: ROUTES.NFT_DETAIL(':photocardId'), element: withBoundary(<NftDetailPage />) },

      /* 검색은 하단 탭 없이 화면을 꽉 씁니다 — 입력에 집중하고 뒤로가기로 나갑니다 */
      { path: ROUTES.SEARCH, element: withBoundary(<SearchPage />) },

      {
        element: <RequireAuth />,
        children: [
          { path: ROUTES.FACE_REGISTER, element: withBoundary(<FaceRegisterPage />) },
          { path: ROUTES.FACE_DONE, element: withBoundary(<FaceDonePage />) },
          { path: ROUTES.TOKEN, element: withBoundary(<TokenPage />) },

          { path: ROUTES.TICKET_DETAIL(':ticketId'), element: withBoundary(<TicketDetailPage />) },
          { path: ROUTES.MY_NFTS, element: withBoundary(<MyNftsPage />) },
          { path: ROUTES.MY_NFT_TRADES, element: withBoundary(<NftTradesPage />) },
          { path: ROUTES.MY_RESALE, element: withBoundary(<MyResalePage />) },
          { path: ROUTES.SETTINGS, element: withBoundary(<SettingsPage />) },
          { path: ROUTES.SETTINGS_PASSWORD, element: withBoundary(<PasswordChangePage />) },
          { path: ROUTES.SETTINGS_NICKNAME, element: withBoundary(<NicknameChangePage />) },
          { path: ROUTES.SETTINGS_ABOUT, element: withBoundary(<AboutPage />) },

          /* 결제창(모바일 리디렉션)에서 돌아오는 곳.
             ⚠️ 일부러 RequireFace / RequireCaptcha **밖**에 둡니다.
             결제는 이미 끝난 상태인데 가드에 막히면 승인 요청을 못 보내
             "돈은 빠졌는데 티켓이 없는" 사고가 납니다. */
          {
            path: ROUTES.BOOKING_PAYMENT_RESULT(':scheduleId'),
            element: withBoundary(<PaymentResultPage />),
          },

          /* 예매 완료 화면도 같은 이유로 가드 밖입니다.
             결제·발권이 끝난 뒤에 보여주는 화면인데 여기서 튕기면
             티켓은 발급됐는데 사용자는 실패한 줄 압니다.
             (이 화면은 얼굴 미등록 사용자에게 등록을 안내하는 역할도 합니다) */
          { path: ROUTES.BOOKING_DONE(':orderId'), element: withBoundary(<BookingDonePage />) },

          /* ── 예매 플로우 ──────────────────────────────────
             봇 확인 → 구역 → 좌석 → 확인 → 결제 → 완료
             얼굴 등록(RequireFace)은 예매 진입 조건,
             봇 확인 통과(RequireCaptcha)는 구역 선택부터의 조건입니다. */
          {
            element: <RequireFace />,
            children: [
              {
                path: ROUTES.BOOKING_VERIFY(':scheduleId'),
                element: withBoundary(<BookingVerifyPage />),
              },
              { path: ROUTES.RESALE(':scheduleId'), element: withBoundary(<ResalePage />) },

              {
                element: <RequireCaptcha />,
                children: [
                  {
                    path: ROUTES.BOOKING_SECTION(':scheduleId'),
                    element: withBoundary(<SectionSelectPage />),
                  },
                  {
                    path: ROUTES.BOOKING_SEATS(':scheduleId'),
                    element: withBoundary(<SeatSelectPage />),
                  },
                  {
                    path: ROUTES.BOOKING_REVIEW(':scheduleId'),
                    element: withBoundary(<BookingReviewPage />),
                  },
                  {
                    path: ROUTES.BOOKING_PAYMENT(':scheduleId'),
                    element: withBoundary(<PaymentPage />),
                  },
                ],
              },
            ],
          },

          /* ── 운영 ── */
          {
            element: <RequireRole roles={['ADMIN']} />,
            children: [{ path: ROUTES.MONITORING, element: withBoundary(<MonitoringPage />) }],
          },
        ],
      },

      ...devRoutes,

      { path: ROUTES.NOT_FOUND, element: withBoundary(<NotFoundPage />) },
    ],
  },

];

export const router = createBrowserRouter(routes);
