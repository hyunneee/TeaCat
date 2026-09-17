import { local, STORAGE_KEY } from './storage';

/**
 * 분석 쿠키 동의.
 *
 * ── 왜 필요한가 ──────────────────────────────────────────
 * GA4 와 Clarity 는 첫 파티 쿠키를 심고, 수집한 것을 **국외(미국)로 이전**합니다.
 * 개인정보보호법은 국외이전에 **별도 동의**를 요구하고, 처리방침에 이전받는 자·항목·
 * 국가·목적을 적어 두게 합니다. 동의를 받기 전에는 켜면 안 됩니다.
 *
 * ── 🔴 Sentry 는 여기서 막지 않습니다 ────────────────────
 * 셋 다 국외로 나가지만 성격이 다릅니다. Sentry 는 **서비스를 굴리는 데 필요한**
 * 오류 기록이라 거부해도 켜 둡니다 — 이걸 끄면 배포본에서 터진 사고를 볼 방법이
 * 아예 없어집니다(운영 빌드는 `console.*` 을 지웁니다). 대신 사람을 특정하는 값을
 * 보내지 않도록 `sentry.ts` 에서 요청 본문·쿠키·헤더를 전부 막아 두었습니다.
 * GA·Clarity 는 **없어도 서비스가 돌아가는** 분석이라 동의 대상입니다.
 * 이 구분을 바꾸려면 처리방침 문구도 같이 고쳐야 합니다 (`PrivacyPolicyPage`).
 *
 * ── 저장 위치 ────────────────────────────────────────────
 * localStorage 입니다. 서버에 남기지 않는 이유는, 동의 여부를 서버에 저장하려면
 * **로그인해야** 하는데 동의는 비로그인 첫 방문자에게도 물어야 하기 때문입니다.
 * 기기를 바꾸면 다시 묻습니다 — 쿠키 동의의 일반적인 동작입니다.
 *
 * 🔴 **기본은 수집함**입니다 (opt-out). 값이 없는 것(`null`)은 "아직 아무 말도 안 한
 *    사람" 이고 **수집 대상**입니다. 빠지는 것은 처리방침 화면에서 직접 거부를 누른
 *    `false` 뿐이라, 판단은 `=== true` 가 아니라 **`!== false`** 로 합니다
 *    (`src/instrument.ts`).
 *
 *    `null` 과 `false` 를 `boolean` 하나로 합치지 마세요. 지금은 동작이 같아 보이지만,
 *    동의 배너를 되살리면(opt-in) **"아직 안 물어봄" 과 "물어봤고 싫다고 함" 을 갈라야**
 *    합니다 — 합쳐 두면 거부한 사람에게 배너가 영원히 따라붙습니다.
 */

/** 아직 묻지 않았으면 `null` */
export type AnalyticsConsent = boolean | null;

interface StoredConsent {
  analytics: boolean;
  /** 언제 동의했는지. 처리방침이 바뀌면 다시 물을 근거가 됩니다 */
  at: string;
}

export function readAnalyticsConsent(): AnalyticsConsent {
  const stored = local.get<StoredConsent | null>(STORAGE_KEY.CONSENT, null);
  return stored === null ? null : stored.analytics;
}

export function writeAnalyticsConsent(analytics: boolean): void {
  local.set(STORAGE_KEY.CONSENT, { analytics, at: new Date().toISOString() } satisfies StoredConsent);
}

/** 설정에서 "동의 다시 선택" 을 누를 때. 다음 로드에 배너가 다시 뜹니다 */
export function clearAnalyticsConsent(): void {
  local.remove(STORAGE_KEY.CONSENT);
}
