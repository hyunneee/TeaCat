/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: 'development' | 'production';
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_BASE_URL: string;
  readonly VITE_MAX_TICKETS_PER_USER: string;
  readonly VITE_ENABLE_DEVTOOLS: string;
  readonly VITE_USE_MOCK: string;
  readonly VITE_PAYMENT_MODE: 'auto' | 'mock' | 'toss';
  readonly VITE_TOSS_CLIENT_KEY: string;
  /* 얼굴 등록 — 브라우저에서만 쓰는 모델 파일 주소와 버전 */
  readonly VITE_FACE_DETECTOR_URL: string;
  readonly VITE_FACE_EMBEDDER_URL: string;
  readonly VITE_FACE_MODEL_VERSION: string;
}

/** onnxruntime-web 의 wasm 을 Vite 에셋으로 받아옵니다 (빌드 하나만) */
declare module 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url' {
  const url: string;
  export default url;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
