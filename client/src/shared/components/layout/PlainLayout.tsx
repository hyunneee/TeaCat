import { PageTransition } from '@/shared/components/common';

/** 하단 탭 없이 화면을 꽉 쓰는 레이아웃 (예매 플로우, 얼굴 등록, 상세 등) */
export function PlainLayout() {
  return (
    <div className="app-frame app-shell mx-auto flex min-h-dvh w-full flex-col lg:max-w-3xl">
      {/* 하단 탭이 없는 화면이라 상단 내비도 두지 않습니다 — 예매·로그인·얼굴 등록처럼
          한 가지 일에 집중하는 흐름이고, 내비가 있으면 중간에 빠져나가기 쉽습니다.

          폭은 `app-shell` 이 정하는데 그건 **lg 에서 상한을 풉니다**(AppLayout 이
          본문에 따로 상한을 걸기 때문). 여기는 본문에 걸어 줄 사람이 없어서
          넓은 화면에서 로그인 폼 하나가 1440px 로 퍼집니다 — 그래서 직접 잡습니다.
          48rem 은 AppLayout 본문(64rem)보다 좁습니다. 한 가지 일만 하는 화면이고,
          입력 칸이 길어질수록 어디를 채워야 하는지 눈이 헤맵니다. */}
      <PageTransition />
    </div>
  );
}
