/**
 * 앱의 모든 경로. 문자열을 화면에 흩뿌리지 말고 반드시 여기를 통해 쓰세요.
 *   navigate(ROUTES.CONCERT_DETAIL(id))
 * 경로가 바뀌어도 이 파일만 고치면 되고, 오타는 타입 에러로 잡힙니다.
 */
export const ROUTES = {
  HOME: '/',

  /* ── 인증 ── */
  LOGIN: '/login',
  SIGNUP: '/signup',
  SIGNUP_DONE: '/signup/done',

  /* ── 얼굴 등록 (티켓 사용 자격) ── */
  FACE_REGISTER: '/face',

  /* ── 검색 (공연 + 포토카드 한 화면) ── */
  SEARCH: '/search',

  /* ── 공연 ── */
  CONCERTS: '/concerts',
  CONCERT_DETAIL: (concertId: string) => `/concerts/${concertId}`,

  /* ── 예매 플로우 ──
     공연상세 → 봇 확인 → 구역 → 좌석 → 확인 → 결제 → 완료 */
  BOOKING_VERIFY: (scheduleId: string) => `/booking/${scheduleId}/verify`,
  BOOKING_SECTION: (scheduleId: string) => `/booking/${scheduleId}/section`,
  BOOKING_SEATS: (scheduleId: string) => `/booking/${scheduleId}/seats`,
  BOOKING_REVIEW: (scheduleId: string) => `/booking/${scheduleId}/review`,
  BOOKING_PAYMENT: (scheduleId: string) => `/booking/${scheduleId}/payment`,
  /**
   * 결제창(모바일 리디렉션)에서 돌아오는 곳.
   *
   * ⚠️ 이 라우트는 **로그인 가드만** 통과하면 들어올 수 있어야 합니다.
   * 얼굴 등록·봇 확인 가드를 걸면, 결제는 끝났는데 가드에 막혀
   * 승인 요청을 못 보내고 티켓이 발급되지 않는 사고가 납니다.
   */
  BOOKING_PAYMENT_RESULT: (scheduleId: string) => `/booking/${scheduleId}/payment/result`,
  BOOKING_DONE: (orderId: string) => `/booking/done/${orderId}`,

  /* ── 취소표 추첨 대기 (NRF) ── */
  RESALE: (scheduleId: string) => `/booking/${scheduleId}/resale`,
  MY_RESALE: '/my/resale',

  /* ── 내 티켓 ── */
  MY_TICKETS: '/my/tickets',
  TICKET_DETAIL: (ticketId: string) => `/my/tickets/${ticketId}`,

  /* ── 포토카드 NFT ── */
  NFT_MARKET: '/nft',
  NFT_DETAIL: (nftId: string) => `/nft/${nftId}`,
  MY_NFTS: '/my/nfts',
  MY_NFT_TRADES: '/my/nfts/trades',

  /* ── 토큰 채굴 (컨텐츠 미정) ── */
  TOKEN: '/token',

  /* ── 마이페이지 ── */
  MY: '/my',
  SETTINGS: '/my/settings',
  SETTINGS_PASSWORD: '/my/settings/password',
  SETTINGS_ABOUT: '/my/settings/about',

  /* ── 운영 ── */
  MONITORING: '/admin/monitoring',

  NOT_FOUND: '*',
} as const;

/** 예매 플로우 단계 라벨 — Stepper 에 그대로 넘깁니다. */
export const BOOKING_STEPS = ['봇 확인', '구역', '좌석', '확인', '결제'] as const;
