import { PageTransition } from '@/shared/components/common';

/** 하단 탭 없이 화면을 꽉 쓰는 레이아웃 (예매 플로우, 얼굴 등록, 상세 등) */
export function PlainLayout() {
  return (
    <div className="app-frame mx-auto flex min-h-dvh w-full app-width flex-col">
      <PageTransition />
    </div>
  );
}
