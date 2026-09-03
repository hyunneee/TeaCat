import { http } from '@/shared/api';
import type {
  AuthTokens,
  ChangeNicknameRequest,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  CaptchaChallenge,
  SignupRequest,
  SignupResponse,
  User,
} from '../model/auth.types';

/**
 * 서버와 대화하는 유일한 창구 (Model 레이어).
 * 컴포넌트가 http 를 직접 호출하는 일은 없어야 합니다.
 *
 * 리프레시 토큰은 httpOnly 쿠키로 오가므로 이 파일에 토큰을 다루는 코드가 없습니다.
 */
export const authApi = {
  login: (body: LoginRequest) =>
    http.post<LoginResponse>('/auth/login', body, { skipAuthRefresh: true }),

  /** 가입은 로그인시키지 않습니다 — 완료 화면을 보여주고 사용자가 직접 로그인합니다. */
  signup: (body: SignupRequest) =>
    http.post<SignupResponse>('/auth/signup', body, { skipAuthRefresh: true }),

  logout: () => http.post<void>('/auth/logout'),

  refresh: () => http.post<AuthTokens>('/auth/refresh', undefined, { skipAuthRefresh: true }),

  me: () => http.get<User>('/users/me'),

  changePassword: (body: ChangePasswordRequest) => http.patch<void>('/users/me/password', body),

  changeNickname: (body: ChangeNicknameRequest) => http.patch<void>('/users/me/nickname', body),

  withdraw: () => http.delete<void>('/users/me'),

  /* 자동입력 방지 (캡차) — TODO(backend): 아직 목업입니다 */
  issueCaptcha: () => http.get<CaptchaChallenge>('/auth/captcha'),

  verifyCaptcha: (body: { challengeId: string; answer: string; scheduleId: string }) =>
    http.post<{ verified: boolean }>('/auth/captcha/verify', body),
};

/** 쿼리 키를 문자열로 흩뿌리면 무효화(invalidate)할 때 반드시 사고가 납니다. */
export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
  captcha: (scheduleId: string) => [...authKeys.all, 'captcha', scheduleId] as const,
};
