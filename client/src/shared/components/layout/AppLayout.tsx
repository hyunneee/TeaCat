import { PageTransition } from '@/shared/components/common';
import { BottomNav } from './BottomNav';

/**
 * 하단 탭이 있는 기본 레이아웃.
 *
 * 본문 아래 여백(.pb-nav)은 탭 높이 + 여유 + 노치입니다.
 * 여유가 없으면 목록 마지막 항목이 탭에 가리고, 폰에서 화면 맨 아래는
 * 엄지가 닿기 어려워 그 항목을 누르기도 힘듭니다.
 */
export function AppLayout() {
  return (
    <div className="app-frame mx-auto flex min-h-dvh w-full app-width flex-col">
      <main className="pb-nav flex-1">
        <PageTransition />
      </main>
      <BottomNav />
    </div>
  );
}
