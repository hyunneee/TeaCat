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
  /* 에러 리포팅 — DSN 이 비어 있으면 Sentry 를 아예 켜지 않습니다 */
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE: string;
  /* dev/prod 구분과 커밋 표시. 배포에서는 CI 가 --build-arg 로 넘깁니다 */
  readonly VITE_SENTRY_ENVIRONMENT: string;
  readonly VITE_SENTRY_RELEASE: string;
  /* 행동 분석 — 비어 있으면 Clarity 를 아예 켜지 않습니다.
     🔴 dev/prod 는 **프로젝트를 따로** 만들어 서로 다른 ID 를 넘깁니다 (Clarity 에는 환경 태그가 없습니다) */
  readonly VITE_CLARITY_PROJECT_ID: string;
  /* 이용 분석 — 비어 있으면 GA4 를 아예 켜지 않습니다.
     🔴 dev/prod 는 **속성을 따로** 만들어 서로 다른 측정 ID 를 넘깁니다 (GA4 에도 환경 태그가 없습니다) */
  readonly VITE_GA_MEASUREMENT_ID: string;
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
