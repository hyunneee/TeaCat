import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../model/auth.types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  /**
   * OTP 인증을 통과한 회차 id.
   * 예매 플로우(구역/좌석/결제)의 진입 조건입니다. 회차가 바뀌면 다시 인증해야 합니다.
   */
  otpVerifiedFor: string | null;

  setSession: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string | null) => void;
  setOtpVerified: (scheduleId: string | null) => void;
  patchUser: (patch: Partial<User>) => void;
  clear: () => void;

  isLoggedIn: () => boolean;
}

/**
 * 클라이언트 상태만 담습니다. (로그인 여부, 토큰, OTP 통과 여부)
 * "서버에 있는 최신 내 정보"는 TanStack Query 가 관리합니다 — 역할을 섞지 마세요.
 *
 * 보안 주의: accessToken 을 localStorage 에 두면 XSS 에 노출됩니다.
 * 운영에서는 refreshToken 을 httpOnly 쿠키로 받고, accessToken 은
 * persist 대상에서 빼서 메모리에만 두는 쪽이 안전합니다. (partialize 참고)
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      otpVerifiedFor: null,

      setSession: (user, accessToken) => set({ user, accessToken, otpVerifiedFor: null }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setOtpVerified: (scheduleId) => set({ otpVerifiedFor: scheduleId }),
      patchUser: (patch) => set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),
      clear: () => set({ user: null, accessToken: null, otpVerifiedFor: null }),

      isLoggedIn: () => !!get().accessToken,
    }),
    {
      name: 'ticket.auth',
      storage: createJSONStorage(() => localStorage),
      // 새로고침해도 유지할 값만 고릅니다.
      // (예매 중 새로고침해도 OTP 를 다시 받지 않도록 otpVerifiedFor 도 포함)
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        otpVerifiedFor: s.otpVerifiedFor,
      }),
    },
  ),
);
