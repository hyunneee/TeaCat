/**
 * 관리자가 적어 넣는 **바로가기 주소** 규칙.
 *
 * 배너와 공연 상세의 "바로가기" 가 같은 규칙을 씁니다. 받는 것은 둘뿐입니다.
 *
 * | 형태 | 예 | 어떻게 여나 |
 * |---|---|---|
 * | 서비스 내 경로 | `/nft/draw` | 같은 탭에서 라우터로 이동 |
 * | 외부 주소 | `https://example.com/event` | 새 탭 |
 *
 * 🔴 **`http` · `https` 말고 다른 스킴은 받지 않습니다.** `javascript:alert(1)` 을 그대로
 *    `href` 나 `window.open` 에 넘기면 우리 페이지 안에서 그 코드가 돕니다 — 관리자만
 *    쓰는 화면이라도, 관리자 계정 하나가 뚫리면 모든 방문자에게 실행됩니다.
 *    `data:` 도 같은 이유로 막습니다(HTML 을 통째로 실어 우리 주소처럼 보이게 할 수 있습니다).
 *
 * 🔴 **`//evil.com` 도 막습니다.** 슬래시 두 개는 "지금 프로토콜 그대로 저 도메인" 이라
 *    경로처럼 보이지만 실제로는 바깥으로 나갑니다. 그래서 내부 경로는 슬래시 **하나**로
 *    시작하는 것만 인정합니다.
 *
 * ⚠️ 여기서 막는 것은 **입력 실수와 사고**입니다. 진짜 방어선은 서버입니다 —
 *    같은 규칙이 `BannerWriteRequest` · `ConcertCreateRequest` 의 `@Pattern` 에 있습니다.
 *    한쪽만 고치면 화면은 통과시키는데 서버가 400 을 내거나, 그 반대가 됩니다.
 */

/** 서버의 `@Pattern` 과 **같은 식**입니다. 고칠 때 양쪽을 함께 고치세요 */
export const LINK_PATTERN = /^(\/(?!\/)[^\s]*|https?:\/\/[^\s]+)$/;

/** 비어 있으면 "이동 없음" 이라 유효합니다 — 필수 입력이 아닙니다 */
export function isValidLink(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || LINK_PATTERN.test(trimmed);
}

/** 바깥으로 나가는 주소인가. 새 탭으로 열지, 라우터로 이동할지를 가릅니다 */
export function isExternalLink(value: string | null | undefined): boolean {
  return !!value && /^https?:\/\//.test(value.trim());
}

/**
 * 외부 주소를 새 탭으로 엽니다.
 *
 * 🔴 `noopener` 를 빼지 마세요. 빼면 열린 쪽이 `window.opener` 로 **우리 탭의 주소를
 *    바꿀 수 있습니다**(탭내빙). 링크를 넣는 사람이 관리자라도, 그 주소가 가리키는
 *    페이지까지 우리가 고른 것은 아닙니다.
 *
 * 값이 외부 주소가 아니면 아무 일도 하지 않습니다 — 내부 경로를 새 탭으로 열면
 * 앱이 통째로 다시 뜨면서 로그인 상태만 남고 화면 흐름이 끊깁니다.
 */
export function openExternalLink(url: string): void {
  if (!isExternalLink(url)) return;
  window.open(url.trim(), '_blank', 'noopener,noreferrer');
}
