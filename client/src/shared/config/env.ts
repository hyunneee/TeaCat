/**
 * 환경변수 단일 진입점.
 *
 * 규칙: 코드 어디에서도 `import.meta.env` 를 직접 쓰지 않습니다.
 *       전부 여기를 거칩니다. 그래야
 *         1) 오타가 나면 앱 시작 시점에 바로 터지고 (배포 후 런타임에 터지지 않음)
 *         2) 타입이 붙고
 *         3) 어떤 환경변수가 쓰이는지 이 파일만 보면 됩니다.
 */

type AppEnvName = 'development' | 'production';

/**
 * **빌드 시점 상수.** Vite 가 `import.meta.env.DEV` 를 리터럴로 치환하므로,
 * 이 값으로 감싼 블록은 운영 번들에서 **코드째 사라집니다.**
 *
 * `env.isDev` 와 다릅니다 — 그건 런타임 값이라 감싸도 코드가 번들에 남습니다.
 * 개발 전용 화면처럼 **운영에 아예 안 나가야 하는 것**에만 이걸 쓰세요.
 */
export const IS_DEV_BUILD = import.meta.env.DEV;

function required(key: string): string {
  const value = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  if (value === undefined || value === '') {
    throw new Error(
      `[env] 필수 환경변수 ${key} 가 없습니다. .env.${import.meta.env.MODE} 파일을 확인하세요.`,
    );
  }
  return value;
}

function optionalBool(key: string, fallback: boolean): boolean {
  const value = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

function optionalString(key: string, fallback: string): string {
  const value = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  return value === undefined || value === '' ? fallback : value;
}

function optionalNumber(key: string, fallback: number): number {
  const value = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export type PaymentMode = 'mock' | 'toss';

/**
 * 결제 설정 (토스페이먼츠).
 *
 * 기본값 'auto' 는 **클라이언트 키가 채워져 있으면 실제 결제창, 비어 있으면 모의 결제**입니다.
 * 키만 .env 에 넣으면 코드 수정 없이 실제 테스트 결제창이 뜨고,
 * 키를 깜빡해도 배포본이 깨지지 않습니다.
 *
 * ⚠️ 클라이언트 키(`test_ck_...` / `live_ck_...`)는 브라우저에 노출되는 공개 키입니다.
 *    결제를 **승인**하는 시크릿 키(`test_sk_...` / `test_gsk_...`)는 절대 프론트에 두지 마세요.
 *    `VITE_` 값은 번들에 그대로 박혀 브라우저에서 누구나 읽습니다 — 백엔드 전용입니다.
 *
 * 클라이언트 키는 **두 종류**이고 짝이 되는 SDK 가 다릅니다.
 *   test_ck_...   API 개별 연동 키 → tossPayments.payment()  → **새 창 결제창**
 *   test_gck_...  결제위젯 연동 키 → tossPayments.widgets()  → 페이지에 삽입
 * 키 접두사로 자동 판별하므로, 개별 연동 키를 넣으면 코드 수정 없이 새 창으로 바뀝니다.
 */
function paymentConfig() {
  const clientKey = (import.meta.env.VITE_TOSS_CLIENT_KEY ?? '').trim();
  const configured = clientKey.length > 0;

  const requested = (import.meta.env.VITE_PAYMENT_MODE ?? 'auto') as PaymentMode | 'auto';
  const mode: PaymentMode = requested === 'auto' ? (configured ? 'toss' : 'mock') : requested;

  /* 위젯 키인지 개별 연동 키인지. 잘못 짝지으면 SDK 가 연동을 거절합니다. */
  const widgetKey = /_gck_/.test(clientKey);

  return { mode, clientKey, configured, widgetKey } as const;
}

/** 0~1 표본율. `optionalNumber` 와 달리 **0 을 허용**합니다 (추적 끄기). */
function rate(key: string, fallback: number): number {
  const raw = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

/**
 * 에러 리포팅 (Sentry).
 *
 * DSN 이 비어 있으면 **아예 켜지 않습니다.** 로컬 개발에서 아무 설정 없이 받아도
 * 조용히 꺼진 상태로 돌아가고, 팀원 노트북의 에러가 대시보드를 더럽히지 않습니다.
 *
 * ⚠️ DSN 은 브라우저에 노출되는 **공개 값**입니다 (이벤트를 보내는 주소일 뿐,
 *    대시보드를 읽는 권한이 아닙니다). 소스맵 업로드에 쓰는 `SENTRY_AUTH_TOKEN` 은
 *    전혀 다른 물건이고, 절대 `VITE_` 로 두면 안 됩니다 — CI 환경변수 전용입니다.
 *
 * 표본율(tracesSampleRate)은 **성능 추적**에만 쓰입니다. 에러는 표본과 무관하게
 * 전부 올라갑니다. 티켓 오픈 순간 트래픽이 몰릴 때 무료 할당량이 몇 분 만에
 * 소진되지 않도록 운영은 10% 만 봅니다.
 */
function sentryConfig() {
  const dsn = optionalString('VITE_SENTRY_DSN', '').trim();
  const isProd = (import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE) === 'production';

  return {
    dsn,
    /** DSN 이 있어야만 켜집니다 */
    enabled: dsn.length > 0,

    /* 🔴 `env.name` 을 쓰면 안 됩니다. dev 배포도 `--mode production` 으로 빌드해서
       (client/Dockerfile · Jenkinsfile) dev 에서 난 에러가 production 으로 찍힙니다.
       CI 가 넘겨주는 이 값이 dev/prod 를 가릅니다. 로컬은 기본값 그대로. */
    environment: optionalString('VITE_SENTRY_ENVIRONMENT', import.meta.env.MODE),

    /* 어느 커밋에서 난 에러인지. CI 가 `teacat-client@<짧은 커밋 해시>` 를 넣습니다.
       로컬에서는 앱 버전으로 대신합니다. */
    release: optionalString(
      'VITE_SENTRY_RELEASE',
      `teacat-client@${optionalString('VITE_APP_VERSION', '0.0.0')}`,
    ),

    tracesSampleRate: rate('VITE_SENTRY_TRACES_SAMPLE_RATE', isProd ? 0.1 : 1),
  } as const;
}

/**
 * 행동 분석 (Microsoft Clarity).
 *
 * 프로젝트 ID 가 비어 있으면 **아예 켜지 않습니다.** Sentry 의 DSN 과 같은 규칙입니다 —
 * 로컬 개발에서 아무 설정 없이 받아도 조용히 꺼진 채로 돌아가고, 팀원 노트북의
 * 세션이 히트맵을 오염시키지 않습니다.
 *
 * ⚠️ 프로젝트 ID 는 브라우저에 노출되는 **공개 값**입니다 (스크립트 주소에 그대로 실립니다).
 *    대시보드를 읽는 권한이 아닙니다. 데이터 내보내기용 API 토큰은 전혀 다른 물건이고,
 *    절대 `VITE_` 로 두면 안 됩니다.
 *
 * 🔴 Clarity 에는 Sentry 의 `environment` 같은 태그가 **없습니다.** dev·prod 를
 *    가르려면 **프로젝트를 환경별로 하나씩** 만들고 CI 가 서로 다른 ID 를 넘겨야 합니다.
 *    같은 ID 를 쓰면 히트맵이 섞입니다. (shared/lib/clarity.ts 주석)
 */
function clarityConfig() {
  const projectId = optionalString('VITE_CLARITY_PROJECT_ID', '').trim();

  return {
    projectId,
    /** 프로젝트 ID 가 있어야만 켜집니다 */
    enabled: projectId.length > 0,
  } as const;
}

/**
 * 이용 분석 (Google Analytics 4).
 *
 * 측정 ID 가 비어 있으면 **아예 켜지 않습니다.** Sentry 의 DSN, Clarity 의 프로젝트 ID 와
 * 같은 규칙입니다 — 팀원 노트북의 클릭이 세션·이탈률을 오염시키면 지표를 못 믿게 됩니다.
 *
 * ⚠️ 측정 ID(`G-...`)는 브라우저에 노출되는 **공개 값**입니다 (스크립트 주소에 그대로 실립니다).
 *    리포트를 읽는 권한이 아닙니다. Data API 용 서비스 계정 키는 전혀 다른 물건이고,
 *    절대 `VITE_` 로 두면 안 됩니다.
 *
 * 🔴 Clarity 와 마찬가지로 GA4 에도 Sentry 의 `environment` 같은 태그가 **없습니다.**
 *    dev·prod 를 가르려면 **속성을 환경별로 하나씩** 만들고 CI 가 서로 다른 측정 ID 를
 *    넘겨야 합니다. 같은 ID 를 쓰면 개발 중 클릭이 운영 지표에 그대로 섞입니다.
 *    (지금은 운영 속성만 있습니다 — Jenkinsfile 의 GA_ID)
 */
function gaConfig() {
  const measurementId = optionalString('VITE_GA_MEASUREMENT_ID', '').trim();

  return {
    measurementId,
    /** 측정 ID 가 있어야만 켜집니다 */
    enabled: measurementId.length > 0,
  } as const;
}

export const env = {
  /** 'development' | 'production' */
  name: (import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE) as AppEnvName,
  appName: required('VITE_APP_NAME'),
  /** 지금 실행 중인 앱 버전 (설정 > 앱 정보) */
  appVersion: optionalString('VITE_APP_VERSION', '0.0.0'),

  apiBaseUrl: required('VITE_API_BASE_URL'),
  wsBaseUrl: required('VITE_WS_BASE_URL'),

  /** 배포 정책상 1인 최대 구매 매수. dev=4, prod=1 */
  maxTicketsPerUser: optionalNumber('VITE_MAX_TICKETS_PER_USER', 1),

  enableDevtools: optionalBool('VITE_ENABLE_DEVTOOLS', false),

  /** 목업 데이터 사용 여부. 백엔드 완성 후 .env 에서 false 로 두고 src/mocks 를 지우면 됩니다. */
  useMock: optionalBool('VITE_USE_MOCK', false),

  /* ── 결제 (토스페이먼츠) ─────────────────────────────────
     클라이언트 키는 브라우저에 노출되는 공개 키입니다.
     승인에 쓰는 시크릿 키는 백엔드에만 두세요. */
  payment: paymentConfig(),

  /* ── 에러 리포팅 (Sentry) ────────────────────────────────
     DSN 이 없으면 꺼진 채로 동작합니다. shared/lib/sentry.ts 참고. */
  sentry: sentryConfig(),

  /* ── 행동 분석 (Microsoft Clarity) ───────────────────────
     프로젝트 ID 가 없으면 꺼진 채로 동작합니다.
     🔴 켜기 전에 대시보드 마스킹을 Strict 로 바꿔야 합니다 — shared/lib/clarity.ts 참고. */
  clarity: clarityConfig(),

  /* ── 이용 분석 (Google Analytics 4) ──────────────────────
     측정 ID 가 없으면 꺼진 채로 동작합니다.
     🔴 SPA 라 페이지뷰를 직접 보냅니다 — shared/lib/ga.ts 의 '향상된 측정' 주석을 읽으세요. */
  ga: gaConfig(),

  /* ── 얼굴 등록 ───────────────────────────────────────────
     🔴 모델 파일은 **브라우저에서만** 씁니다. 서버로 얼굴 이미지를 보내는 설정은
        여기에도, 어디에도 없습니다. (CLAUDE.md 7장)
     modelVersion 은 게이트 검표와 **같아야** 대조가 됩니다. 모델을 바꾸면 반드시 올리세요. */
  face: {
    detectorUrl: optionalString('VITE_FACE_DETECTOR_URL', '/models/face_detection_yunet_2023mar.onnx'),
    embedderUrl: optionalString('VITE_FACE_EMBEDDER_URL', '/models/face_recognition_sface_2021dec_int8.onnx'),
    modelVersion: optionalString('VITE_FACE_MODEL_VERSION', 'yunet2023mar+sface2021dec-int8@1'),
  },

  get isProd() {
    return this.name === 'production';
  },
  get isDev() {
    return this.name === 'development';
  },
} as const;
