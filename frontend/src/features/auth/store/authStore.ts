import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../model/auth.types';

interface AuthState {
  /**
   * 마지막으로 본 내 정보의 **스냅샷**. 새로고침 직후 `/auth/me` 응답이 오기 전
   * 한 프레임 동안 화면을 그리기 위한 값입니다.
   *
   * 🔴 **여기를 직접 고치지 마세요.** 내 정보의 원본은 TanStack Query 캐시
   * (`authKeys.me()`) 하나뿐이고, 이 값은 `useAuth` 가 거기서 **베껴 씁니다.**
   * 양쪽을 각각 고치면 두 벌이 어긋나 "얼굴 등록했는데 미등록으로 보이는" 사고가 납니다.
   */
  userSnapshot: User | null;
  accessToken: string | null;
  /**
   * 자동입력 방지(캡차)를 통과한 회차 id.
   * 예매 플로우(구역/좌석/결제)의 진입 조건입니다. 회차가 바뀌면 다시 확인합니다.
   */
  captchaVerifiedFor: string | null;

  setSession: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string | null) => void;
  setCaptchaVerified: (scheduleId: string | null) => void;
  /** `useAuth` 전용 — 쿼리 캐시의 내 정보를 스냅샷에 반영합니다. */
  syncUserSnapshot: (user: User | null) => void;
  clear: () => void;
}

/**
 * 클라이언트 상태만 담습니다. (토큰, 캡차 통과 여부, 첫 렌더용 사용자 스냅샷)
 * "서버에 있는 최신 내 정보"는 TanStack Query 가 관리합니다 — 역할을 섞지 마세요.
 *
 * 보안 주의: accessToken 을 localStorage 에 두면 XSS 에 노출됩니다.
 * 운영에서는 refreshToken 을 httpOnly 쿠키로 받고, accessToken 은
 * persist 대상에서 빼서 메모리에만 두는 쪽이 안전합니다. (partialize 참고)
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userSnapshot: null,
      accessToken: null,
      captchaVerifiedFor: null,

      setSession: (user, accessToken) =>
        set({ userSnapshot: user, accessToken, captchaVerifiedFor: null }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setCaptchaVerified: (scheduleId) => set({ captchaVerifiedFor: scheduleId }),
      syncUserSnapshot: (user) =>
        // 같은 객체면 쓰지 않습니다 — 불필요한 구독자 리렌더를 막습니다.
        set((s) => (s.userSnapshot === user ? s : { userSnapshot: user })),
      clear: () => set({ userSnapshot: null, accessToken: null, captchaVerifiedFor: null }),
    }),
    {
      name: 'ticket.auth',
      storage: createJSONStorage(() => localStorage),
      // 새로고침해도 유지할 값만 고릅니다.
      // (예매 중 새로고침해도 다시 풀지 않도록 captchaVerifiedFor 도 포함)
      partialize: (s) => ({
        userSnapshot: s.userSnapshot,
        accessToken: s.accessToken,
        captchaVerifiedFor: s.captchaVerifiedFor,
      }),
    },
  ),
);
