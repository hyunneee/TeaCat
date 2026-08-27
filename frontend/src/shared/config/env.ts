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

function optionalNumber(key: string, fallback: number): number {
  const value = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  /** 'development' | 'production' */
  name: (import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE) as AppEnvName,
  appName: required('VITE_APP_NAME'),

  apiBaseUrl: required('VITE_API_BASE_URL'),
  wsBaseUrl: required('VITE_WS_BASE_URL'),

  /** 배포 정책상 1인 최대 구매 매수. dev=4, prod=1 */
  maxTicketsPerUser: optionalNumber('VITE_MAX_TICKETS_PER_USER', 1),

  enableDevtools: optionalBool('VITE_ENABLE_DEVTOOLS', false),

  /** 목업 데이터 사용 여부. 백엔드 완성 후 .env 에서 false 로 두고 src/mocks 를 지우면 됩니다. */
  useMock: optionalBool('VITE_USE_MOCK', false),

  /* ── 결제 (포트원 V2) ─────────────────────────────────────
     storeId / channelKey 는 브라우저에 노출되는 **공개 키**입니다.
     결제를 실제로 승인하는 V2 API Secret 은 백엔드에만 두세요. */
  payment: {
    /** 'mock' 이면 결제창을 띄우지 않고 모의 승인합니다. */
    mode: (import.meta.env.VITE_PAYMENT_MODE ?? 'mock') as 'mock' | 'portone',
    storeId: import.meta.env.VITE_PORTONE_STORE_ID ?? '',
    channelKey: import.meta.env.VITE_PORTONE_CHANNEL_KEY ?? '',
  },

  get isProd() {
    return this.name === 'production';
  },
  get isDev() {
    return this.name === 'development';
  },
} as const;
