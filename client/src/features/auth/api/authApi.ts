import { http } from '@/shared/api';
import { env } from '@/shared/config';
import type {
  AuthTokens,
  CaptchaChallenge,
  ChangeNicknameRequest,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  OauthSignupRequest,
  PendingOauthSignup,
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

  /* ── SSAFY 계정 로그인 ── */

  /**
   * SSAFY 로그인 시작 주소.
   *
   * axios 로 부르지 않고 **페이지를 이동**시킵니다. 리디렉션을 따라가야 하고,
   * 돌아올 때 서버가 httpOnly 쿠키를 심어 주기 때문입니다.
   */
  ssafyAuthorizeUrl: (): string => env.apiBaseUrl + '/auth/oauth/ssafy/authorize',

  /** 가입 대기 정보 (가입 티켓 쿠키로 식별) */
  oauthPending: () => http.get<PendingOauthSignup>('/auth/oauth/ssafy/pending'),

  oauthSignup: (body: OauthSignupRequest) =>
    http.post<LoginResponse>('/auth/oauth/ssafy/signup', body, { skipAuthRefresh: true }),

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
  oauthPending: () => [...authKeys.all, 'oauth', 'pending'] as const,
};
