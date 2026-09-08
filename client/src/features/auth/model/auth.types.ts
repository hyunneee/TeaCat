/** 서비스 이용 주체. 서버의 user_role ENUM 과 같습니다. */
export type UserRole = 'USER' | 'ADMIN' | 'STADIUM' | 'PERFORMANCE';

/** 서버 `GET /users/me` 응답 그대로입니다. 필드를 바꾸려면 서버부터 바꾸세요. */
export interface User {
  userId: number;
  email: string;
  /** 실명 — 입장 시 신분 확인용 */
  name: string;
  /** 표시 이름. 티켓 수령인을 지정할 때 쓰는 식별자이기도 합니다 */
  nickname: string;
  phone: string;
  role: UserRole;
  /** 얼굴 등록 완료 여부 — 티켓 사용(입장)의 전제 조건 */
  faceRegistered: boolean;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  nickname: string;
  phone: string;
}

export interface SignupResponse {
  userId: number;
  email: string;
  nickname: string;
}

export interface AuthTokens {
  accessToken: string;
  tokenType: string;
  /** 만료까지 남은 시간(초) */
  expiresIn: number;
}

/**
 * 로그인 응답.
 *
 * 리프레시 토큰은 여기 없습니다 — 서버가 httpOnly 쿠키로 내려주고 JS 는 읽을 수 없습니다.
 * 401 이 나면 `shared/api/client.ts` 가 그 쿠키로 조용히 재발급을 시도합니다.
 */
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

export interface ChangeNicknameRequest {
  nickname: string;
}

/* ── SSAFY 계정 로그인 ── */

/** SSAFY 인증은 끝났지만 가입이 안 끝난 상태. 화면을 미리 채우는 용도입니다 */
export interface PendingOauthSignup {
  email: string;
  /** SSAFY 가 이름을 주지 않으면 null */
  name: string | null;
}

export interface OauthSignupRequest {
  name: string;
  nickname: string;
  phone: string;
}
