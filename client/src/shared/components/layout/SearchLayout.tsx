import { PageTransition } from '@/shared/components/common';
import { TopNav } from './TopNav';

/**
 * 통합 검색 전용 껍데기.
 * 모바일은 검색 입력에 집중하도록 하단 탭 없이 유지하고, 데스크톱에서는 다른 주요 화면과
 * 같은 상단 내비를 보여 검색 결과에서 헤더가 사라지지 않게 합니다.
 */
export function SearchLayout() {
  return (
    <div className="app-frame app-shell with-topnav mx-auto flex min-h-dvh w-full flex-col">
      <TopNav />
      <main className="flex-1 overflow-x-clip">
        <PageTransition />
      </main>
    </div>
  );
}
