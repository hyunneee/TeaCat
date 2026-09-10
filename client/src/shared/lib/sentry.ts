import { useEffect } from 'react';
import { createRoutesFromChildren, matchRoutes, useLocation, useNavigationType } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { env } from '@/shared/config';
import { ApiError } from '@/shared/api';

/**
 * 에러 리포팅 (Sentry).
 *
 * 운영 빌드는 `console.*` 를 통째로 제거합니다(vite.config.ts 의 esbuild.drop).
 * 즉 **배포본에서 터진 에러는 아무 데도 남지 않습니다.** 여기가 그 자리를 대신합니다.
 *
 * ── 켜지는 조건 ──────────────────────────────────────────
 * `VITE_SENTRY_DSN` 이 있을 때만 켜집니다. 없으면 이 파일의 함수들은 전부
 * 아무 일도 하지 않습니다. 그래서 로컬에서 `.env` 를 건드리지 않아도 되고,
 * 팀원 노트북에서 난 에러가 대시보드를 채우지 않습니다.
 *
 * ── 🔴 생체정보 (CLAUDE.md 7장) ──────────────────────────
 * Session Replay 를 **쓰지 않습니다.** 얼굴 등록 화면의 카메라 프리뷰와 결제창이
 * 그대로 녹화되기 때문입니다. `replayIntegration()` 을 추가하지 마세요(0번 절차).
 * 임베딩 벡터도 마찬가지입니다 — 아래 `dataCollection.httpBodies: []` 가 요청 본문을
 * 통째로 버리고, `beforeSend` 가 한 겹 더 걷어냅니다.
 */

/** 이벤트에서 지워야 하는 헤더. 값 자체가 그대로 계정 탈취 수단입니다. */
const SECRET_HEADERS = ['authorization', 'cookie', 'set-cookie', 'idempotency-key'];

/**
 * 올려도 얻는 게 없는 에러들.
 *
 * 브라우저·확장프로그램이 만드는 잡음입니다. 그냥 두면 실제 버그가 파묻힙니다.
 */
const IGNORED = [
  // 레이아웃 계산 중 한 프레임 밀린 것. 크롬이 알림만 띄우고 실제 문제는 없습니다
  'ResizeObserver loop',
  // 광고 차단기·번역 확장이 우리 코드를 건드리다 나는 것
  'Extension context invalidated',
  'chrome-extension://',
  // 사용자가 이동해서 취소된 요청
  'AbortError',
  'Non-Error promise rejection captured with value: undefined',
];

/**
 * 이 에러를 Sentry 에 올릴 가치가 있는가.
 *
 * 예매 화면은 `SEAT_ALREADY_HELD`(누가 먼저 잡음), `CAPTCHA_REQUIRED` 같은
 * **정상 동작**을 에러로 던집니다. 티켓 오픈 1분이면 수만 건이 쌓여서
 * 할당량을 태우고 진짜 사고를 가립니다. 서버가 깨진 신호(5xx)와
 * 네트워크 이상만 남깁니다.
 */
function isWorthReporting(error: unknown): boolean {
  if (!ApiError.isApiError(error)) return true;

  // 네트워크 끊김(status 0)은 사용자 환경 문제라 대부분 잡음입니다.
  if (error.isNetworkError) return false;

  // 400번대는 "그렇게 하면 안 됩니다" 라는 정상 응답입니다. 429(과호출)만 남깁니다.
  if (error.isClientError) return false;

  return true;
}

/** 이벤트에 딸려 가는 민감한 값들을 지웁니다. */
function scrub(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const request = event.request;

  if (request) {
    if (request.headers) {
      for (const key of Object.keys(request.headers)) {
        if (SECRET_HEADERS.includes(key.toLowerCase())) delete request.headers[key];
      }
    }

    /* 🔴 요청 본문은 통째로 버립니다.
       얼굴 임베딩(`POST /users/me/face`), 비밀번호, 결제 정보가 여기로 옵니다.
       "필요한 것만 남기기" 로는 새 API 가 생길 때마다 빠뜨립니다. */
    delete request.data;

    // 주소창 쿼리에 토큰이 실려 오는 경로가 있습니다 (OAuth 콜백)
    if (request.query_string) delete request.query_string;
  }

  return event;
}

/** 앱이 그려지기 전에 딱 한 번. `main.tsx` 의 bootstrap 맨 앞에서 부릅니다. */
export function initSentry(): void {
  if (!env.sentry.enabled) return;

  Sentry.init({
    dsn: env.sentry.dsn,

    /* dev/prod 를 가르는 태그. 🔴 `env.name` 이 아닙니다 — dev 배포도 production 모드로
       빌드하기 때문입니다. 자세한 건 shared/config/env.ts 의 sentryConfig 주석. */
    environment: env.sentry.environment,

    /* 어느 배포에서 난 에러인지. 소스맵을 올리게 되면 이 값으로 짝을 맞춥니다. */
    release: env.sentry.release,

    integrations: [
      /* 라우트 이동·API 호출 구간을 잽니다.
         🔴 replayIntegration 은 넣지 않습니다 (위 생체정보 주석)

         🔴 **`browserTracingIntegration()` 이 아니라 이걸 써야 합니다.**
            리액트 라우터 전용 버전만 `wrapCreateBrowserRouter`(router.tsx)를
            실제로 동작하게 만듭니다. 일반 버전을 쓰면 감싸기가 조용히 무시돼서
            지표 이름이 `/concerts/12345`, `/concerts/98765` … 로 흩어집니다.
            (SDK 가 경고도 안 냅니다 — 확인하려면 지표의 source 가 `route` 인지 보세요) */
      Sentry.reactRouterBrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],

    /* 성능 추적 표본율. 에러는 이 값과 무관하게 전부 올라갑니다. */
    tracesSampleRate: env.sentry.tracesSampleRate,

    /* 우리 API 호출에만 트레이스 헤더를 붙입니다.
       외부(토스페이먼츠·S3)에 붙이면 그쪽 CORS 가 막아 요청이 실패합니다. */
    tracePropagationTargets: [/^\/api/],

    /* 🔴 여기가 생체정보 방어선입니다 (CLAUDE.md 7장).
       SDK 가 **기본으로 수집하는 것들을 카테고리별로 끕니다.**
       예전 `sendDefaultPii: false` 를 대체하는 옵션이고, 기본값이 훨씬 넓습니다 —
       아무것도 안 적으면 요청 본문·쿠키·헤더가 다 올라갑니다. */
    dataCollection: {
      // IP 주소·브라우저가 아는 사용자 정보를 자동으로 붙이지 않습니다.
      // 누구인지는 setSentryUser 로 우리가 id 만 정해서 넣습니다.
      userInfo: false,

      // 리프레시 토큰이 httpOnly 쿠키로 오갑니다. 통째로 막습니다.
      cookies: false,

      // Authorization 헤더 = 그대로 계정 탈취 수단
      httpHeaders: { request: false, response: false },

      // 🔴 가장 중요. 빈 배열이 "본문 수집 안 함" 입니다.
      //    얼굴 임베딩(POST /users/me/face), 비밀번호, 결제 정보가 전부 본문입니다.
      httpBodies: [],

      // OAuth 콜백 주소에 인가 코드가 쿼리로 실려 옵니다.
      urlQueryParams: false,

      // 스택 프레임의 지역 변수. 임베딩 배열이 통째로 잡힐 수 있습니다.
      stackFrameVariables: false,
    },

    ignoreErrors: IGNORED,

    beforeSend(event, hint) {
      if (!isWorthReporting(hint.originalException)) return null;
      return scrub(event);
    },
  });
}

/**
 * 에러 하나를 직접 올립니다.
 *
 * 전역 핸들러가 못 잡는 자리에서만 쓰세요 —
 * React 렌더 에러(ErrorBoundary), 삼켜버리는 `catch` 블록.
 * 그냥 던지는 에러는 SDK 가 알아서 잡습니다.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!env.sentry.enabled) return;
  if (!isWorthReporting(error)) return;

  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * 누구에게 난 에러인지 표시합니다. 로그인·로그아웃 때 부릅니다.
 *
 * 🔴 **id 만** 넣습니다. 이메일·닉네임·전화번호를 넣지 마세요 —
 *    Sentry 는 우리 개인정보 처리 위탁 대상이 아닙니다.
 *    사용자를 특정해야 하면 이 id 로 우리 DB 에서 찾으면 됩니다.
 */
export function setSentryUser(userId: string | number | null): void {
  if (!env.sentry.enabled) return;

  Sentry.setUser(userId === null ? null : { id: String(userId) });
}
