/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: 'development' | 'production';
  readonly VITE_APP_NAME: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_BASE_URL: string;
  readonly VITE_MAX_TICKETS_PER_USER: string;
  readonly VITE_ENABLE_DEVTOOLS: string;
  readonly VITE_USE_MOCK: string;
  readonly VITE_PAYMENT_MODE: 'auto' | 'mock' | 'toss';
  readonly VITE_TOSS_CLIENT_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
