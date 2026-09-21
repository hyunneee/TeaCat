import { PageTransition } from '@/shared/components/common';
import { TopNav } from './TopNav';
import { SectionNavigation } from './SectionNavigation';

/** 탐색 가능한 하위 화면. 모바일은 뒤로가기, 데스크톱은 공통 상단 내비를 유지한다. */
export function DetailLayout() {
  return (
    <div className="app-frame app-shell with-topnav mx-auto flex min-h-dvh w-full flex-col">
      <TopNav />
      <main className="flex-1 overflow-x-clip pb-6 lg:pb-10">
        <div className="mx-auto w-full lg:max-w-5xl lg:px-6">
          <SectionNavigation />
          <PageTransition />
        </div>
      </main>
    </div>
  );
}
