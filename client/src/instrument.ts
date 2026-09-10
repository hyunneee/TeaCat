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
import { initSentry } from '@/shared/lib';

initSentry();
