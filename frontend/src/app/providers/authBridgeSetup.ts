import { registerAuthBridge } from '@/shared/api';
import { authApi, useAuthStore } from '@/features/auth';

/**
 * shared/api(HTTP 클라이언트)에 auth feature 구현을 꽂아 넣습니다.
 *
 * 이 한 번의 연결 덕분에
 *   - shared/api 는 auth feature 를 import 하지 않고 (의존성 역전)
 *   - 인터셉터에서 토큰 첨부 / 401 재발급 / 강제 로그아웃이 전부 동작합니다.
 *
 * main.tsx 에서 앱이 그려지기 전에 딱 한 번 호출합니다.
 */
export function setupAuthBridge() {
  registerAuthBridge({
    getAccessToken: () => useAuthStore.getState().accessToken,

    refresh: async () => {
      try {
        const { accessToken } = await authApi.refresh();
        useAuthStore.getState().setAccessToken(accessToken);
        return accessToken;
      } catch {
        return null;
      }
    },

    onSessionExpired: () => {
      const hadSession = !!useAuthStore.getState().accessToken;
      useAuthStore.getState().clear();

      // 애초에 로그인한 적이 없으면 "만료"가 아닙니다.
      // 공개 화면(NFT 마켓 등)에서 개인 API 가 401 을 냈을 뿐이므로
      // 여기서 로그인 화면으로 튕기면 그냥 둘러보던 사용자를 쫓아내게 됩니다.
      if (!hadSession) return;

      // 라우터 밖이라 navigate 를 쓸 수 없어 하드 이동합니다.
      // (세션 만료는 어차피 앱 상태를 통째로 리셋하는 게 안전합니다)
      window.location.replace('/login');
    },
  });
}
