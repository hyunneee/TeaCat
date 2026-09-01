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
const AboutPage = page(() => import('@/pages/AboutPage'), 'AboutPage');

const MonitoringPage = page(() => import('@/pages/MonitoringPage'), 'MonitoringPage');
const NotFoundPage = page(() => import('@/pages/NotFoundPage'), 'NotFoundPage');

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
  /* ══ 하단 탭이 보이는 화면 ═══════════════════════════════ */
  {
    element: <AppLayout />,
    children: [
      { path: ROUTES.HOME, element: withBoundary(<HomePage />) },
      { path: ROUTES.CONCERTS, element: withBoundary(<ConcertListPage />) },
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
      { path: ROUTES.NFT_DETAIL(':nftId'), element: withBoundary(<NftDetailPage />) },

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
