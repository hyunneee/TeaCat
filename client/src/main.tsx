/* 🔴 이 import 가 **가장 위**에 있어야 합니다. 아래로 내리지 마세요.
   라우터(@/app/router)가 만들어지기 전에 Sentry 가 켜져야 라우트 이름이
   `/concerts/:id` 로 묶입니다. 이유는 src/instrument.ts 주석에 있습니다. */
import './instrument';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setupAuthBridge } from '@/app/providers';
import { trackRouteViews, warmRoutes } from '@/app/router';
import App from './App';
import '@/styles/index.css';

/* 앱이 그려지기 전에 처리해야 하는 부트스트랩 작업들.
   여기 순서를 지켜야 첫 요청부터 토큰이 붙습니다. */
async function bootstrap() {
  setupAuthBridge();

  /* ── 목업 데이터 (백엔드 완성 전 임시) ──────────────────────
     리터럴 비교라서 운영 빌드에서는 이 블록이 통째로 제거되고
     src/mocks 코드도 번들에 들어가지 않습니다.
     백엔드 연동이 끝나면 이 블록과 src/mocks 폴더를 지우면 됩니다. */
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const { setupMocks } = await import('@/mocks');
    await setupMocks();
  }

  const container = document.getElementById('root');
  if (!container) throw new Error('#root 엘리먼트를 찾을 수 없습니다.');

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  /* 화면이 그려진 뒤, 한가할 때 자주 가는 화면의 코드를 미리 받습니다.
     (이동할 때 화면이 비었다가 채워지는 걸 없앱니다 — router.tsx 의 warmRoutes) */
  warmRoutes();

  /* 화면이 그려진 **뒤에** 붙입니다. 첫 페이지뷰는 이 함수가 직접 한 번 보냅니다
     (라우터 구독은 첫 진입에서 불리지 않습니다 — app/router/analytics.ts). */
  trackRouteViews();
}

void bootstrap();
