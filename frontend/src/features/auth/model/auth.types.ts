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
  email: string;
  /** 선택 항목 — 없으면 보내지 않습니다 */
  phone?: string;
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

/* ── 자동입력 방지 (예매 진입 관문) ── */

/**
 * 캡차 문제.
 *
 * ⚠️ 정답은 절대 내려오지 않습니다. 프론트가 정답을 알면 캡차가 아닙니다.
 *    서버가 그린 그림(`imageDataUrl`)과 글자 수만 옵니다.
 */
export interface CaptchaChallenge {
  challengeId: string;
  /** 문제 이미지 (data URL 또는 이미지 주소) */
  imageDataUrl: string;
  /** 입력해야 할 글자 수 */
  length: number;
  expiresInSeconds: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
