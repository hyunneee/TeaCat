/**
 * Sentry 켜기. **이 파일은 `main.tsx` 의 맨 첫 줄에서 import 합니다.**
 *
 * ── 왜 별도 파일인가 (지우지 마세요) ─────────────────────────
 * `bootstrap()` 안에서 부르면 **늦습니다.** import 는 전부 hoisting 돼서
 * 본문보다 먼저 실행되기 때문입니다. 그러면 이런 순서가 됩니다.
 *
 *   1. `@/app/router` 가 평가됨 → `wrapCreateBrowserRouter(...)` 실행
 *   2. `bootstrap()` 본문 → `Sentry.init()` 실행   ← 너무 늦음
 *
 * 라우터 감싸기는 `Sentry.init()` 이 심어둔 값(useEffect·matchRoutes 등)을
 * 보고 동작합니다. 아직 없으면 **원본 함수를 그대로 돌려주고 조용히 넘어갑니다.**
 * 에러도 경고도 안 납니다. 대신 성능 지표 이름이 `/concerts/12345` 처럼
 * id 별로 흩어져서 "공연 상세가 느리다" 를 영영 볼 수 없게 됩니다.
 *
 * import 는 **적힌 순서대로** 평가되므로, 이 파일이 첫 줄이면
 * 라우터가 만들어지기 전에 Sentry 가 준비됩니다.
 *
 * 확인하는 법: 대시보드에서 지표 하나를 열어 `source` 가 `route` 인지 보세요.
 * `url` 이면 이 순서가 깨진 것입니다.
 */
import { initClarity, initGa, initSentry, readAnalyticsConsent } from '@/shared/lib';

initSentry();

/**
 * 분석 도구(GA4 · Clarity)는 **동의를 받은 뒤에만** 켭니다.
 *
 * 둘 다 쿠키를 심고 수집한 것을 국외로 이전해서, 개인정보보호법상 별도 동의가
 * 필요합니다. 동의 전에는 스크립트조차 받지 않습니다 — "받아 두고 전송만 참기" 는
 * 이미 쿠키가 심긴 뒤라 동의를 받은 것이 아닙니다.
 *
 * 🔴 Sentry 는 위에서 **무조건** 켭니다. 서비스 운영에 필요한 오류 기록이고,
 *    이걸 끄면 배포본에서 터진 사고를 볼 방법이 없어집니다(운영 빌드는 console 을
 *    지웁니다). 판단 근거는 `shared/lib/consent.ts` 주석에 적어 두었습니다.
 *
 * 🔴 아직 안 물어본 사람(`null`)과 거부한 사람(`false`) 모두 켜지 않습니다.
 *    배너에서 허용을 누르면 `startAnalytics()` 가 그 자리에서 켭니다 —
 *    새로고침을 기다리지 않습니다(그러면 첫 세션이 통째로 빕니다).
 */
export function startAnalytics(): void {
  /* 행동 분석 (Clarity). Sentry 와 달리 **순서 제약이 없습니다** — 라우터를 감싸지 않고
     DOM 만 봅니다. `async` 스크립트를 꽂는 것뿐이라 첫 페인트를 막지 않습니다.

     🔴 개인정보가 뜨는 화면은 `router.tsx` 의 `withMask` 로 가려야 합니다.
        빠뜨리면 리플레이에 그대로 남습니다. shared/lib/clarity.ts 를 읽으세요. */
  initClarity();

  /* 이용 분석 (GA4). 페이지뷰는 여기서 보내지 않습니다 — SPA 라 라우트 구독이
     대신 보냅니다 (`app/router/analytics.ts` 의 trackRouteViews). */
  initGa();
}

/* 이미 허용한 사람은 이 시점에 바로 켭니다. 처음 온 사람·거부한 사람은 켜지 않고,
   배너(`CookieConsent`)가 허용을 받으면 그때 `startAnalytics()` 를 부릅니다. */
if (readAnalyticsConsent() === true) startAnalytics();
