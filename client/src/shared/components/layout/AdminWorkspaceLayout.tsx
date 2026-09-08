import { PageTransition } from '@/shared/components/common';

/** 좌석 배치처럼 넓은 작업 영역이 필요한 승인된 관리자 전용 레이아웃. */
export function AdminWorkspaceLayout() {
  return (
    <div className="app-frame mx-auto flex min-h-dvh w-full max-w-7xl flex-col">
      <PageTransition />
    </div>
  );
}
