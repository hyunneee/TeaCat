import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { PageLoader } from './PageLoader';

/**
 * 라우트 하나를 감싸는 안전망.
 *
 * `resetKey` 에 현재 경로를 넘기는 게 핵심입니다.
 * 이게 없으면 한 화면에서 에러가 터진 뒤 다른 메뉴를 눌러도
 * 에러 화면에 갇혀서 앱을 새로고침해야 합니다.
 */
export function RouteBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}
