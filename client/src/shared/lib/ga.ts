import { env } from '@/shared/config';

/**
 * 이용 분석 (Google Analytics 4).
 *
 * Sentry 가 "무엇이 터졌나", Clarity 가 "어디서 막히나" 라면
 * 이쪽은 **"몇 명이 어디까지 갔나"** 입니다. 유입 경로·재방문·퍼널 이탈률처럼
 * **세는** 지표를 봅니다. 셋은 겹치지 않으니 하나로 대체하려 하지 마세요.
 *
 * ── 켜지는 조건 ──────────────────────────────────────────
 * `VITE_GA_MEASUREMENT_ID` 가 있을 때만 켜집니다. 없으면 이 파일의 함수들은
 * 전부 아무 일도 하지 않습니다. Sentry(DSN)·Clarity(프로젝트 ID) 와 같은 규칙이고,
 * 이유도 같습니다 — 팀원 노트북의 클릭이 지표를 오염시키면 못 쓰게 됩니다.
 *
 * ── 🔴 SPA 라서 페이지뷰를 **직접** 보냅니다 ─────────────
 * gtag 스니펫은 스크립트가 로드될 때 딱 한 번 페이지뷰를 보냅니다. 우리는
 * react-router 로 화면만 갈아끼우고 실제 페이지 로드가 없으니, 그대로 두면
 * **세션당 페이지뷰가 영원히 1** 입니다. 그래서 `send_page_view: false` 로 끄고
 * 라우트가 바뀔 때마다 `trackPageView` 를 부릅니다 (`app/router/analytics.ts`).
 *
 * 🔴 그러면 GA 웹 콘솔의 **향상된 측정 > 페이지 조회수 > "브라우저 기록 이벤트 기반
 *    페이지 변경" 을 꺼야 합니다.** 그건 GA 가 `history.pushState` 를 감지해 스스로
 *    페이지뷰를 보내는 기능이라, 켜 둔 채로 여기서도 보내면 **모든 화면 이동이
 *    두 번씩 집계됩니다.** 코드로는 끌 수 없고 사람이 대시보드에서 꺼야 합니다
 *    (관리 > 데이터 스트림 > 향상된 측정 > 톱니바퀴).
 *
 * ── 🔴 개인정보를 보내지 마세요 (7장) ────────────────────
 * Clarity 의 마스킹 같은 안전망이 **여기엔 없습니다.** GA 는 화면을 보는 게 아니라
 * 우리가 보내는 값만 받으므로, 이 파일을 거쳐 나가는 것은 전부 우리가 쓴 값입니다.
 * 이메일·닉네임·전화번호·주문번호·좌석번호를 파라미터에 넣지 마세요.
 * 넣는 순간 GA4 약관 위반이고, 적발되면 **속성이 삭제됩니다** (경고 후 유예 없음).
 * 얼굴 관련 값은 말할 것도 없습니다 — 애초에 이 코드가 닿는 곳에 없습니다.
 *
 * URL 도 같은 이유로 조심해야 합니다. 지금 라우트에는 개인정보가 없지만
 * (`/tickets/:id` 의 id 는 우리 내부 번호입니다), 쿼리스트링에 이메일 같은 걸
 * 붙이는 화면을 새로 만들면 그대로 GA 에 실려 갑니다.
 *
 * ── 참고: 광고 차단기 ────────────────────────────────────
 * uBlock·브레이브·사파리 강화 추적 방지가 `googletagmanager.com` 을 막습니다.
 * 실제로 **20~40% 는 집계에서 빠진다**고 보고 절대값이 아니라 **추세와 비율**로
 * 읽으세요. 매출 정산에는 절대 쓰면 안 됩니다 — 그건 서버 데이터가 기준입니다.
 */

type GtagParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** gtag 큐. 스크립트가 아직 안 왔어도 여기 쌓였다가 로드되는 순간 한꺼번에 처리됩니다. */
function gtag(...args: unknown[]): void {
  window.dataLayer?.push(args);
}

/** 앱이 그려지기 전에 딱 한 번. `main.tsx` 가 import 하는 `instrument.ts` 에서 부릅니다. */
export function initGa(): void {
  if (!env.ga.enabled) return;
  // 두 번 불려도 스크립트를 두 벌 꽂지 않습니다 (StrictMode·HMR).
  if (window.dataLayer) return;

  window.dataLayer = [];

  gtag('js', new Date());
  gtag('config', env.ga.measurementId, {
    /* 🔴 이걸 지우면 첫 화면이 두 번 집계됩니다 (여기서 한 번, 아래 trackPageView 로 또 한 번).
       위 주석의 "향상된 측정" 설정과 함께, 페이지뷰는 **한 곳에서만** 보내야 합니다. */
    send_page_view: false,
  });

  const script = document.createElement('script');
  script.async = true; // 첫 페인트를 막지 않습니다
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(env.ga.measurementId)}`;
  document.head.appendChild(script);
}

/**
 * 화면 하나를 봤다고 알립니다. **라우트가 바뀔 때마다** 부릅니다
 * (`app/router/analytics.ts` 가 라우터를 구독해서 대신 불러줍니다).
 *
 * `page_path` 는 쿼리스트링을 뺀 경로만 보냅니다 — 캡차 토큰이나 결제 리다이렉트
 * 파라미터 같은 것이 리포트에 쌓이면 같은 화면이 수십 줄로 흩어지고,
 * 그중에 민감한 값이 섞이면 지울 방법이 없습니다.
 */
export function trackPageView(path: string, title?: string): void {
  if (!env.ga.enabled) return;

  gtag('event', 'page_view', {
    page_path: path,
    page_title: title ?? document.title,
    page_location: `${window.location.origin}${path}`,
  });
}

/**
 * 우리가 직접 세는 사건. 퍼널(공연 상세 → 좌석 → 인증 → 결제)을 만들려면 필요합니다.
 *
 * 이름은 GA4 규칙대로 **snake_case** 로 쓰세요 (`seat_selected`, `face_verify_failed`).
 * 자동으로 잡히는 클릭·스크롤로 안 보이는 것에만 씁니다 — `trackClarityEvent` 와
 * 판단 기준이 같습니다. 다만 저쪽은 세션을 되짚기 위한 표시이고, 이쪽은 **숫자**입니다.
 *
 * 🔴 params 에 사람을 특정하는 값이나 좌석번호를 넣지 마세요. 사건의 **종류**와
 *    집계에 쓸 분류값(공연 id, 실패 사유 코드)만 넣습니다.
 */
export function trackGaEvent(name: string, params?: GtagParams): void {
  if (!env.ga.enabled) return;

  gtag('event', name, params ?? {});
}

/**
 * 여러 기기에서 같은 사람으로 묶습니다. 로그인·로그아웃 때 부릅니다.
 *
 * 🔴 **내부 id 만** 넣습니다. `setSentryUser`·`setClarityUser` 와 같은 규칙입니다 —
 *    이메일·닉네임·전화번호는 GA4 가 금지하는 값입니다 (위 "개인정보" 항목).
 */
export function setGaUser(userId: string | number | null): void {
  if (!env.ga.enabled) return;

  gtag('set', { user_id: userId === null ? undefined : String(userId) });
}
