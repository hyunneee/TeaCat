/**
 * shared 레이어는 특정 도메인(auth feature)을 몰라야 하는데
 * HTTP 클라이언트는 토큰이 필요합니다. 이 모순을 의존성 역전으로 풉니다.
 *
 * - shared/api 는 "토큰을 주는 함수"라는 인터페이스만 알고,
 * - 실제 구현(authStore) 은 앱 시작 시점(app/providers)에 주입합니다.
 *
 * 덕분에 shared/api 는 테스트에서 가짜 토큰 제공자를 꽂아 넣을 수 있습니다.
 */
export interface AuthBridge {
  getAccessToken: () => string | null;
  /** 리프레시 성공 시 새 액세스 토큰 반환, 실패 시 null */
  refresh: () => Promise<string | null>;
  /** 리프레시까지 실패했을 때 (강제 로그아웃 처리) */
  onSessionExpired: () => void;
}

const noop: AuthBridge = {
  getAccessToken: () => null,
  refresh: async () => null,
  onSessionExpired: () => {},
};

let bridge: AuthBridge = noop;

export function registerAuthBridge(impl: AuthBridge) {
  bridge = impl;
}

export function getAuthBridge(): AuthBridge {
  return bridge;
}
