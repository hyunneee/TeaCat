import Clarity from '@microsoft/clarity';
import { env } from '@/shared/config';

/**
 * 행동 분석 (Microsoft Clarity).
 *
 * Sentry 가 "무엇이 터졌나" 라면 이쪽은 **"어디서 막히나"** 입니다.
 * 히트맵·rage click(연타)·dead click(눌렀는데 반응 없음)·퍼널을 봅니다.
 *
 * ── 켜지는 조건 ──────────────────────────────────────────
 * `VITE_CLARITY_PROJECT_ID` 가 있을 때만 켜집니다. 없으면 이 파일의 함수들은
 * 전부 아무 일도 하지 않습니다. Sentry 와 같은 규칙이고, 이유도 같습니다 —
 * 팀원 노트북의 세션이 대시보드를 채우면 지표가 못 쓰게 됩니다.
 *
 * ── 🔴 프로젝트를 환경별로 하나씩 두세요 ─────────────────
 * Clarity 에는 Sentry 의 `environment` 같은 개념이 **없습니다.** dev 와 prod 가
 * 같은 프로젝트 ID 를 쓰면 히트맵이 섞여서 어느 쪽 수치인지 분간이 안 됩니다.
 * 프로젝트는 무료·무제한이니 dev 용과 prod 용을 따로 만들고, CI 가
 * `--build-arg VITE_CLARITY_PROJECT_ID` 로 각각 넘깁니다 (Jenkinsfile).
 *
 * ── 🔴 마스킹이 유일한 방어선입니다 (7장) ────────────────
 * Clarity 의 공식 API 에는 **`stop` 이 없습니다** (`init`·`setTag`·`identify`·
 * `consent`·`event`·`upgrade` 뿐). 즉 SPA 에서 **라우트 단위로 끌 수 없습니다.**
 * 홈에서 스크립트가 한 번 로드되면 결제 화면으로 이동해도 계속 기록됩니다.
 * "민감한 라우트에서는 로드하지 않기" 는 첫 진입 라우트만 막는 반쪽짜리입니다.
 *
 * 그래서 방어를 **두 겹**으로 둡니다.
 *
 *   1. `index.html` 의 `#root`·`#modal-root` 에 `data-clarity-mask="true"`
 *      → 화면에 그려지는 **모든 것**이 기본 차단입니다. 페이지를 새로 만들 때
 *        아무것도 안 해도 가려집니다. (`sentry.ts` 의 `httpBodies: []` 와 같은 발상 —
 *        "민감한 것만 골라 가리기" 는 새 화면이 생길 때마다 빠뜨립니다)
 *      → 포탈(`#modal-root`)은 `#root` 의 자식이 아니므로 **따로** 적어야 합니다.
 *        빠뜨리면 모달·토스트 내용만 그대로 올라갑니다.
 *   2. 대시보드 **설정 > 마스킹 > Strict** (기본값은 Balanced 입니다)
 *      → 이건 코드로 강제할 수 없습니다. 웹에서 사람이 바꿔야 합니다.
 *        🔴 마스킹 변경은 **소급 적용되지 않습니다.** 새 리코딩부터,
 *           반영까지 최대 1시간입니다. 켜기 **전에** 바꿔 두세요.
 *
 * 마스킹해도 **히트맵과 rage/dead click 은 그대로 나옵니다.** 클릭 집계는 요소의
 * 위치와 횟수를 세는 것이라 텍스트 마스킹과 무관합니다. 읽기 어려워지는 건
 * 리플레이 화면뿐이고, 우리가 보려는 지표는 손실이 없습니다.
 *
 * ── 참고: 안 잡히는 것 ───────────────────────────────────
 * Clarity 는 화면 녹화가 아니라 **DOM 재생**입니다. 그래서
 *   - `<canvas>`·`<video>` 내용은 올라가지 않습니다 (얼굴 등록 카메라 프리뷰 포함)
 *   - 토스 결제창은 third-party iframe 이라 내부가 보이지 않습니다
 *   - 좌석맵 히트맵은 회차마다 그림이 달라 사실상 의미가 없습니다 —
 *     좌석 화면에서 쓸 수 있는 건 rage/dead click **횟수**와 리코딩입니다
 */

/** 앱이 그려지기 전에 딱 한 번. `main.tsx` 가 import 하는 `instrument.ts` 에서 부릅니다. */
export function initClarity(): void {
  if (!env.clarity.enabled) return;

  /* 패키지가 하는 일은 `https://www.clarity.ms/tag/<id>` 를 `async` 스크립트로
     꽂는 것뿐입니다. async 라 첫 페인트를 막지 않습니다.
     두 번 불러도 스크립트 id 로 걸러내므로 안전합니다. */
  Clarity.init(env.clarity.projectId);
}

/**
 * 누구의 세션인지 표시합니다. 로그인·로그아웃 때 부릅니다.
 *
 * 🔴 **id 만** 넣습니다. `setSentryUser` 와 같은 규칙입니다 —
 *    이메일·닉네임·전화번호를 넣지 마세요. Clarity 는 우리 개인정보 처리
 *    위탁 대상이 아니고, 이 값은 마스킹과 무관하게 **그대로** 올라갑니다.
 *    (마스킹은 화면에 그려진 DOM 을 가리는 것이고, 이건 우리가 직접 보내는 값입니다)
 *
 * 🔴 `init` 보다 먼저 부르면 아무 일도 일어나지 않습니다. 패키지가 `window.clarity`
 *    큐를 `init` 안에서 만들기 때문입니다. 그래서 `enabled` 가 아니면 즉시 빠집니다.
 */
export function setClarityUser(userId: string | number | null): void {
  if (!env.clarity.enabled) return;
  if (userId === null) return;

  Clarity.identify(String(userId));
}

/**
 * 우리가 직접 표시하는 사건. 대시보드의 smart event 목록에 함께 뜹니다.
 *
 * 자동으로 잡히는 클릭·스크롤로는 안 보이는 것에만 쓰세요. 예를 들어
 * 좌석 선점 실패(`SEAT_ALREADY_HELD`)는 **요청이 실패한 것**이라 클릭 지도에
 * 남지 않습니다. 이걸 표시해 두면 "연타 → 실패" 흐름을 세션에서 되짚을 수 있습니다.
 *
 * 🔴 이름에 사람을 특정하는 값이나 좌석 번호를 넣지 마세요. 사건의 **종류**만 넣습니다.
 *    (`seat_hold_failed` ○ / `seat_hold_failed_A12_홍길동` ✗)
 */
export function trackClarityEvent(name: string): void {
  if (!env.clarity.enabled) return;

  Clarity.event(name);
}
