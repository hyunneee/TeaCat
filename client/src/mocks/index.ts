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
    import('./handlers/auth'), // 캡차만 남아 있습니다 (포카는 실서버로 넘어갔습니다)
    // 공연 목록·상세·회차(/concerts, /schedules)는 실서버로 나갑니다
    // 구역·좌석·선점(/schedules/*/seats, /performance-details/*/hold)도 실서버입니다
    //   -> handlers/booking.ts 는 삭제했습니다. 결제도 실서버로 나갑니다.
    // 내 티켓(/users/me/tickets)·예매 취소도 실서버입니다 -> handlers/ticket.ts 삭제
    // 취소표(/schedules/*/resale*, /me/resale, /resale/*)도 실서버입니다 -> handlers/resale.ts 삭제
    //   🔴 목업이 남아 있으면 실서버 회차 ID 로 구역을 찾지 못해 구역 목록이 비어 보입니다 (2026-09-21 dev)
    import('./handlers/appInfo'),
    // AI 스티커(/stickers, /users/me/stickers)도 실서버입니다 -> handlers/sticker.ts 삭제
    //   2026-09-21 백엔드 완성 + GPU 워커 연결까지 확인했습니다.
  ]);

  // 등록 안 된 경로는 원래 어댑터(실제 네트워크)로 폴백시킵니다.
  const original = http.raw.defaults.adapter ?? ['xhr', 'fetch'];
  http.raw.defaults.adapter = createMockAdapter(getAdapter(original));

  console.info(
    '%c[MOCK] 일부 도메인만 목업입니다. 회원·인증·얼굴은 실제 서버로 나갑니다.',
    'color:#a855f7;font-weight:bold',
  );
}
