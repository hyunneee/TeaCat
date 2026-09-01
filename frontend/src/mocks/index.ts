import { getAdapter } from 'axios';
import { http } from '@/shared/api';
import { createMockAdapter } from './router';

/**
 * ┌────────────────────────────────────────────────────────────┐
 * │  이 폴더는 백엔드가 완성되면 통째로 삭제합니다.              │
 * │                                                            │
 * │  삭제 절차                                                  │
 * │   1. .env.* 에서 VITE_USE_MOCK 제거                         │
 * │   2. main.tsx 의 setupMocks() 블록 삭제                     │
 * │   3. src/mocks 폴더 삭제                                    │
 * │  끝. 화면·훅·api 파일은 하나도 안 건드립니다.                │
 * └────────────────────────────────────────────────────────────┘
 *
 * 운영 빌드에서는 main.tsx 의 `import.meta.env.VITE_USE_MOCK === 'true'` 조건이
 * 빌드 시점에 false 로 치환되어, 이 모듈 자체가 번들에서 빠집니다.
 */
export async function setupMocks() {
  // 핸들러 파일들은 import 되는 순간 스스로 라우트를 등록합니다.
  await Promise.all([
    import('./handlers/auth'),
    import('./handlers/concert'),
    import('./handlers/booking'),
    import('./handlers/ticket'),
    import('./handlers/resale'),
    import('./handlers/nft'),
    import('./handlers/token'),
    import('./handlers/banner'),
    import('./handlers/payment'),
    import('./handlers/appInfo'),
  ]);

  // 등록 안 된 경로는 원래 어댑터(실제 네트워크)로 폴백시킵니다.
  const original = http.raw.defaults.adapter ?? ['xhr', 'fetch'];
  http.raw.defaults.adapter = createMockAdapter(getAdapter(original));

  console.info(
    '%c[MOCK] 목업 데이터로 동작 중입니다. 로그인: ssafy / ssafy1234',
    'color:#a855f7;font-weight:bold',
  );
}
