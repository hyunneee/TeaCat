import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setupAuthBridge } from '@/app/providers';
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
}

void bootstrap();
