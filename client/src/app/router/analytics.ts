import { router } from './router';
import { trackPageView } from '@/shared/lib';

/**
 * 라우트가 바뀔 때마다 GA4 에 페이지뷰를 보냅니다.
 *
 * ── 왜 훅이 아니라 라우터 구독인가 ───────────────────────
 * `useLocation()` 을 쓰는 컴포넌트를 만들면 **레이아웃마다 붙여야** 합니다.
 * 지금 라우트 트리에는 `AppLayout`·`PlainLayout`·`AdminLayout` 에 더해
 * 레이아웃 없이 도는 `NotFoundPage`·개발 전용 라우트까지 있어서, 한 군데만
 * 빠뜨려도 그 화면들이 조용히 집계에서 사라집니다. 라우터를 직접 구독하면
 * **트리 모양과 무관하게** 모든 이동이 한 곳을 지나갑니다.
 *
 * 🔴 구독은 첫 진입에서 **불리지 않습니다.** 이미 그려진 뒤에 붙기 때문입니다.
 *    그래서 아래에서 지금 위치를 한 번 직접 보냅니다. 이 줄을 지우면
 *    **모든 세션의 첫 화면이 통째로 빠집니다** — 유입 경로 분석이 무의미해집니다.
 *
 * 🔴 전송을 **미루지 마세요.** `requestAnimationFrame` 으로 한 프레임 미뤘다가
 *    되돌린 적이 있습니다 — rAF 는 **탭이 화면에 없으면 실행되지 않아서**,
 *    이동 직후 탭을 백그라운드로 보내면 그 페이지뷰가 영영 사라집니다.
 *    (에러도 경고도 없이 조용히 빕니다. 숨긴 탭에서 재현했습니다)
 *    미뤘던 이유는 화면 제목을 기다리려던 것인데, 지금 앱은 `document.title` 을
 *    바꾸는 화면이 하나도 없어서 기다릴 것 자체가 없습니다.
 *
 * GA 가 꺼져 있으면(`VITE_GA_MEASUREMENT_ID` 없음) `trackPageView` 가 즉시 빠지므로
 * 구독만 걸린 채 아무 일도 하지 않습니다.
 */
export function trackRouteViews(): void {
  trackPageView(window.location.pathname);

  let lastPath = window.location.pathname;

  router.subscribe((state) => {
    /* 🔴 경로가 **실제로 바뀐 것만** 보냅니다. 구독은 로딩 시작·완료처럼
       한 번의 이동에도 여러 번 불리고, 검색어 입력처럼 쿼리스트링만 바뀌는
       화면도 있습니다. 그대로 흘리면 페이지뷰가 몇 배로 부풀어 오릅니다. */
    if (state.navigation.state !== 'idle') return;

    const path = state.location.pathname;
    if (path === lastPath) return;
    lastPath = path;

    trackPageView(path);
  });
}
