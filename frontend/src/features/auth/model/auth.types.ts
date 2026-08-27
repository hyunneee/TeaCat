/** 서비스 이용 주체 */
export type UserRole = 'USER' | 'ORGANIZER' | 'ADMIN';

export interface User {
  id: string;
  /** 티켓 수령인을 지정할 때 쓰는 식별자 */
  loginId: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  /** 얼굴 등록 완료 여부 — 티켓 사용(입장)의 전제 조건 */
  faceRegistered: boolean;
  profileImageUrl: string | null;
  /** 포도알 토큰 잔액 */
  tokenBalance: number;
}

export interface LoginRequest {
  loginId: string;
  password: string;
}

export interface SignupRequest {
  loginId: string;
  password: string;
  name: string;
  phone: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  /** 서버가 httpOnly 쿠키로 내려주면 이 필드는 없습니다 */
  refreshToken?: string;
  expiresIn: number;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

/* ── OTP (예매 진입 관문) ── */

export type OtpChannel = 'SMS' | 'EMAIL';

export interface OtpSendResponse {
  channel: OtpChannel;
  expiresInSeconds: number;
  /** 목업 전용 힌트. 실서버에서는 내려오지 않습니다. */
  hint?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
