import { PageTransition } from '@/shared/components/common';
import { BottomNav } from './BottomNav';
import { TopNav } from './TopNav';

/**
 * 주요 화면의 껍데기.
 *
 * ── 폭에 따라 껍데기가 바뀝니다 ─────────────────────────────
 *   ~64rem(1024px)  지금까지와 같습니다 — 한 기둥 + 하단 탭
 *   64rem~          상단 내비(로고·검색·탭) + 넓은 본문
 *
 * 내비는 `navTabs` 하나를 보므로 탭 목록이 갈라지지 않습니다.
 * 둘 중 하나만 보이도록 CSS 로 숨기는 것이지, 화면을 두 벌 만드는 것이 아닙니다.
 *
 * 본문 아래 여백(`.pb-nav`)은 탭 높이 + 여유 + 노치입니다. 여유가 없으면 목록 마지막
 * 항목이 탭에 가리고, 폰에서 화면 맨 아래는 엄지가 닿기 어려워 누르기도 힘듭니다.
 * 데스크톱에는 하단 탭이 없으므로 그 여백을 걷습니다(`lg:pb-0`).
 */
export function AppLayout() {
  return (
    <div className="app-frame app-shell mx-auto flex min-h-dvh w-full flex-col">
      <TopNav />

      <main className="pb-nav flex-1 lg:pb-10">
        {/* 데스크톱에서도 본문을 화면 끝까지 늘리지는 않습니다 — 글줄이 너무 길어집니다.
            상단 내비(TopNav 의 ROW)와 **같은 폭**이라 로고와 본문 왼쪽 끝이 한 줄로 섭니다. */}
        <div className="mx-auto w-full lg:max-w-5xl lg:px-6 lg:pt-2">
          <PageTransition />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
