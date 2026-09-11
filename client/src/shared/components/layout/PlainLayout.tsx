import { PageTransition } from '@/shared/components/common';

/** 하단 탭 없이 화면을 꽉 쓰는 레이아웃 (예매 플로우, 얼굴 등록, 상세 등) */
export function PlainLayout() {
  return (
    <div className="app-frame app-shell mx-auto flex min-h-dvh w-full flex-col">
      {/* 하단 탭이 없는 화면이라 사이드 내비도 두지 않습니다 — 예매·얼굴 등록처럼
          한 가지 일에 집중하는 흐름이고, 내비가 있으면 중간에 빠져나가기 쉽습니다.
          폭은 AppLayout 과 같은 규칙(app-shell)을 씁니다. */}
      <PageTransition />
    </div>
  );
}
