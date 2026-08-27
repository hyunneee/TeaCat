import { http } from '@/shared/api';
import type {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  OtpChannel,
  OtpSendResponse,
  SignupRequest,
  User,
} from '../model/auth.types';

/**
 * 서버와 대화하는 유일한 창구 (Model 레이어).
 * 컴포넌트가 http 를 직접 호출하는 일은 없어야 합니다.
 */
export const authApi = {
  login: (body: LoginRequest) =>
    http.post<LoginResponse>('/auth/login', body, { skipAuthRefresh: true }),

  signup: (body: SignupRequest) =>
    http.post<LoginResponse>('/auth/signup', body, { skipAuthRefresh: true }),

  logout: () => http.post<void>('/auth/logout'),

  refresh: () =>
    http.post<{ accessToken: string }>('/auth/refresh', undefined, { skipAuthRefresh: true }),

  me: () => http.get<User>('/users/me'),

  changePassword: (body: ChangePasswordRequest) => http.patch<void>('/users/me/password', body),

  withdraw: () => http.delete<void>('/users/me'),

  /* OTP */
  sendOtp: (channel: OtpChannel) => http.post<OtpSendResponse>('/auth/otp/send', { channel }),

  verifyOtp: (body: { code: string; scheduleId: string }) =>
    http.post<{ verified: boolean }>('/auth/otp/verify', body),
};

/** 쿼리 키를 문자열로 흩뿌리면 무효화(invalidate)할 때 반드시 사고가 납니다. */
export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};
