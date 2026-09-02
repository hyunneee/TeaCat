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
