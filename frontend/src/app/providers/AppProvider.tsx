import type { ReactNode } from 'react';
import { ErrorBoundary } from '@/shared/components/common';
import { ToastViewport } from '@/shared/components/ui';
import { QueryProvider } from './QueryProvider';
import { ModalRoot } from './modals';

/**
 * 앱 전역에 필요한 것들을 한 겹씩 감쌉니다.
 * Provider 가 늘어나면 여기에만 추가하세요. (main.tsx / App.tsx 는 안 건드림)
 *
 * 바깥 -> 안 순서가 중요합니다:
 *   ErrorBoundary 가 가장 바깥이어야 Provider 초기화 중 에러도 잡습니다.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryProvider>
        {children}
        <ModalRoot />
        <ToastViewport />
      </QueryProvider>
    </ErrorBoundary>
  );
}
