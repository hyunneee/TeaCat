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
    <div className="app-frame app-shell with-topnav mx-auto flex min-h-dvh w-full flex-col">
      <TopNav />

      {/* `overflow-x-clip` — 홈의 초록 배경판처럼 본문 폭을 뚫고 화면 끝까지 가는
          요소(`w-screen`)가 가로 스크롤을 만들지 않게 잡아 둡니다.
          `hidden` 이 아니라 `clip` 이라 안쪽의 sticky 는 그대로 동작합니다. */}
      <main className="pb-nav flex-1 overflow-x-clip lg:pb-10">
        {/* 데스크톱에서도 본문을 화면 끝까지 늘리지는 않습니다 — 글줄이 너무 길어집니다.
            상단 내비(TopNav 의 ROW)와 **같은 폭**이라 로고와 본문 왼쪽 끝이 한 줄로 섭니다.

            위 여백은 **화면마다 다릅니다.** 여기서 한 줄 띄우면 홈의 초록 배경판이
            상단 내비에서 떨어져 그 사이에 흰 띠가 생깁니다. 각 화면이 직접 줍니다. */}
        <div className="mx-auto w-full lg:max-w-5xl lg:px-6">
          <PageTransition />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
