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
  /** SSAFY 로그인 결과를 처리하는 화면 (서버가 여기로 돌려보냅니다) */
  OAUTH_CALLBACK: '/oauth/callback',
  /** SSAFY 인증은 됐지만 가입이 안 끝난 사람이 닉네임·전화번호를 채우는 화면 */
  OAUTH_SIGNUP: '/oauth/signup',

  /* ── 얼굴 등록 (티켓 사용 자격) ── */
  FACE_REGISTER: '/face',
  /** 등록 성공 화면. 상단 알림 한 줄로는 "된 건가?" 가 남습니다. */
  FACE_DONE: '/face/done',
  /* 🔴 사용자용 "본인 확인" 화면은 없앴습니다 (예전 `/face/verify`).
     확인만 하고 티켓 상태는 바꾸지 않는 **검증용 화면**이라 사용자가 할 일이 없었고,
     진짜 본인 확인은 공연장 게이트에서 합니다 — `ADMIN_CHECK_IN`. */

  /* ── 검색 (공연 + 포토카드 한 화면) ── */
  SEARCH: '/search',

  /* ── 공연 ── */
  CONCERTS: '/concerts',
  CONCERT_DETAIL: (concertId: string) => `/concerts/${concertId}`,
  /* 공연 등록·수정은 관리자 기능이라 어드민 콘솔에 있습니다 (ADMIN_CONCERT_* 참고).
     예전에는 여기에도 `/concerts/new`·`/concerts/:id/edit` 가 있었습니다. */

  /* ── 예매 플로우 ──
     공연상세 → 봇 확인 → 구역 → 좌석 → 확인 → 결제 → 완료 */
  BOOKING_VERIFY: (scheduleId: string) => `/booking/${scheduleId}/verify`,
  /**
   * 가상 대기실 (봇 확인 → **대기실** → 구역). 서버가 좌석 페이지 인원을 정원(5,000) 이하로 묶고,
   * 넘치면 여기서 순번을 보며 기다립니다. 대기실이 꺼진 회차(기본)는 이 화면을 건너뜁니다.
   */
  BOOKING_WAITING: (scheduleId: string) => `/booking/${scheduleId}/waiting`,
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
  /**
   * 포카 뽑기. `NFT_DETAIL` 의 `:photocardId` 와 겹쳐 보이지만
   * React Router 는 **정적 세그먼트를 동적보다 우선**해서 여기로 옵니다.
   */
  /** 이벤트 카드팩 받기 — 배너 링크가 여기로 옵니다 */
  NFT_PACK_CLAIM: '/nft/packs',
  NFT_DRAW: '/nft/draw',
  /** 서버 photocardId(숫자)를 문자열로 넘긴다 — `ROUTES.NFT_DETAIL(String(id))` */
  NFT_DETAIL: (photocardId: string) => `/nft/${photocardId}`,
  /** 경매 상세. 비로그인도 구경할 수 있어야 해서 가드 밖에 둡니다 */
  AUCTION_DETAIL: (auctionId: string) => `/auctions/${auctionId}`,
  MY_AUCTIONS: '/my/auctions',
  MY_BIDS: '/my/bids',
  MY_NFTS: '/my/nfts',
  MY_NFT_TRADES: '/my/nfts/trades',
  MY_NFT_SALES: '/my/nfts/sales',

  /* ── AI 스티커 (포카 꾸미기) ──
     진입은 내 포카(`MY_NFTS`) 머리말의 "포카 꾸미기" 버튼 하나입니다.
     `FEATURE.sticker` 가 꺼져 있으면 라우트도 버튼도 등록되지 않습니다. */
  /** 그리기 → 만들기. 정적 경로라 `:id` 류보다 먼저 매칭됩니다 */
  STICKER_CREATE: '/my/stickers/new',
  /** 내가 만든 스티커 목록 */
  MY_STICKERS: '/my/stickers',

  /* ── 캣머니 ── */
  TOKEN: '/token',
  /* 게임은 머리말만 남기고 화면을 꽉 쓰므로 잔액 화면과 **길을 나눕니다** —
     마이페이지에서 잔액을 보러 눌렀는데 게임이 시작되면 안 됩니다. */
  TOKEN_GAME: '/token/game',

  /* ── 마이페이지 ── */
  MY: '/my',
  SETTINGS: '/my/settings',
  SETTINGS_PASSWORD: '/my/settings/password',
  SETTINGS_NICKNAME: '/my/settings/nickname',
  SETTINGS_ABOUT: '/my/settings/about',
  /* 개인정보처리방침 — 쿠키 동의 배너가 링크로 걸어서 **로그인 없이** 열려야 합니다.
     그래서 /my 아래가 아니라 최상위입니다. */
  PRIVACY: '/privacy',

  /* ── 문의 ── */
  MY_INQUIRIES: '/my/inquiries',
  MY_INQUIRY_NEW: '/my/inquiries/new',
  /** 서버 inquiryId(숫자)를 문자열로 넘긴다 — `ROUTES.MY_INQUIRY_DETAIL(String(id))` */
  MY_INQUIRY_DETAIL: (inquiryId: string) => `/my/inquiries/${inquiryId}`,
  MY_INQUIRY_EDIT: (inquiryId: string) => `/my/inquiries/${inquiryId}/edit`,

  /* ── 운영 (어드민 대시보드) ────────────────────────────────
     `/admin` 아래는 **데스크톱 전용** 화면입니다. 앱(모바일)의 `.app-width`
     한 기둥 레이아웃을 쓰지 않고 화면을 꽉 씁니다. (client/CLAUDE.md 8장)

     🔴 사이드바 메뉴를 추가할 때는 여기에 경로를 넣고
        `features/admin` 의 ADMIN_MENU 에 한 줄만 추가하면 됩니다. */
  ADMIN: '/admin',
  ADMIN_USERS: '/admin/users',
  /** 게이트 입장 확인 — QR + 얼굴로 본인을 확인하고 입장 처리합니다 */
  ADMIN_CHECK_IN: '/admin/check-in',
  /** 회원 상세 — 예매·포카를 탭으로 봅니다. 되돌릴 수 없는 동작도 여기에 모읍니다 */
  ADMIN_USER_DETAIL: (userId: string) => `/admin/users/${userId}`,
  MONITORING: '/admin/monitoring',
  ADMIN_STADIUM: '/admin/stadium',
  ADMIN_STADIUMS: '/admin/stadiums',
  ADMIN_STADIUM_DETAIL: (stadiumId: string) => `/admin/stadiums/${stadiumId}`,
  ADMIN_INQUIRIES: '/admin/inquiries',
  ADMIN_BANNERS: '/admin/banners',
  /** 카드 그림(템플릿) — 그림만 올립니다. 수량은 풀에 넣을 때 정합니다 */
  ADMIN_POCA_TEMPLATES: '/admin/poca-templates',
  /** 처음 주는 카드팩을 여닫는 기간 */
  ADMIN_PACK_EVENTS: '/admin/pack-events',
  /** 이벤트 카드팩에서 나올 카드 (공연과 무관) */
  ADMIN_POCA_DESIGNS: '/admin/poca-designs',
  /** 그 공연 카드팩에서 나올 카드 */
  ADMIN_CONCERT_DRAW_POOL: (concertId: string) => `/admin/concerts/${concertId}/draw-pool`,
  ADMIN_ANALYTICS: '/admin/analytics',
  ADMIN_CONCERTS: '/admin/concerts',
  /** 정적 경로라 `:concertId` 보다 먼저 매칭됩니다 (CONCERT_CREATE 와 같은 이유) */
  ADMIN_CONCERT_CREATE: '/admin/concerts/new',
  ADMIN_CONCERT_EDIT: (concertId: string) => `/admin/concerts/${concertId}`,

  /**
   * 개발용 얼굴 인식 검증 화면.
   * 사진 세 장을 넣어 코사인 유사도를 눈으로 확인합니다.
   * ⚠️ 개발 환경에서만 라우터에 등록됩니다 (운영 번들에는 없습니다).
   */
  DEV_FACE: '/dev/face',
  /**
   * 개발용 포카 꾸미기 미리보기 — 로그인 가드 밖에서 그림판을 봅니다.
   * 백엔드가 안 닿는 곳(집·캠퍼스 밖)에서 화면 작업을 하기 위한 길입니다.
   * ⚠️ 개발 환경에서만 라우터에 등록됩니다 (운영 번들에는 없습니다).
   */
  DEV_STICKER: '/dev/sticker',
  DEV_MY_STICKERS: '/dev/stickers',

  NOT_FOUND: '*',
} as const;

/** 예매 플로우 단계 라벨 — Stepper 에 그대로 넘깁니다. */
export const BOOKING_STEPS = ['봇 확인', '구역', '좌석', '확인', '결제'] as const;
