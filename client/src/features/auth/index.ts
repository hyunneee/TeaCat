/**
 * auth feature 의 공개 API.
 *
 * 이 파일에 없는 것은 밖에서 쓸 수 없습니다 (ESLint 가 막습니다).
 * 내부 구현을 자유롭게 리팩터링해도 여기만 유지되면 다른 팀원 코드는 안 깨집니다.
 */

// Controller
export { useAuth, useIsLoggedIn } from './hooks/useAuth';
export { useLogin, useLogout } from './hooks/useLogin';
export { useSignup } from './hooks/useSignup';
export { useCaptcha } from './hooks/useCaptcha';
export {
  startSsafyLogin,
  useOauthCallback,
  useOauthSignup,
  usePendingOauthSignup,
} from './hooks/useOauth';
export { SsafyLoginButton } from './components/SsafyLoginButton';
export {
  SIGNUP_FIELDS,
  EMPTY_SIGNUP,
  validateSignup,
  isSignupValid,
  type SignupForm,
  type SignupErrors,
  type SignupFieldSpec,
  EMPTY_OAUTH_SIGNUP,
  OAUTH_SIGNUP_FIELDS,
  isOauthSignupValid,
  validateOauthSignup,
  type OauthSignupForm,
  type OauthSignupErrors,
} from './model/signup.model';
export { useChangePassword, useChangeNickname, useWithdraw } from './hooks/useAccount';

// Model
export { useAuthStore } from './store/authStore';
export { authApi, authKeys } from './api/authApi';
export { can, hasRole } from './model/permission';
export type {
  User,
  UserRole,
  LoginRequest,
  SignupRequest,
  LoginResponse,
  CaptchaChallenge,
  ChangePasswordRequest,
  ChangeNicknameRequest,
  SignupResponse,
  AuthTokens,
  OauthSignupRequest,
  PendingOauthSignup,
} from './model/auth.types';
