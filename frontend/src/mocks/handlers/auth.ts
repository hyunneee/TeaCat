import { mock, mockError } from '../router';
import { MOCK_OTP_CODE, sessions, users, userFromToken, type MockUser } from '../db';

/** 요청 헤더의 Bearer 토큰으로 로그인한 사용자를 찾습니다. */
export function requireUser(headers: Record<string, string>): MockUser {
  const raw = headers.authorization ?? headers.Authorization ?? '';
  const user = userFromToken(raw.replace('Bearer ', ''));
  if (!user) throw mockError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  return user;
}

const toDto = (u: MockUser) => ({
  id: u.id,
  loginId: u.loginId,
  name: u.name,
  phone: u.phone,
  email: u.email,
  role: u.role,
  faceRegistered: u.faceRegistered,
  profileImageUrl: u.profileImageUrl,
  tokenBalance: u.tokenBalance,
});

let tokenSeq = 0;
function issueToken(userId: string) {
  tokenSeq += 1;
  const token = `mock-access-${userId}-${tokenSeq}`;
  sessions.set(token, userId);
  return token;
}

/* ── 로그인 / 회원가입 ── */

mock('POST', '/auth/login', (ctx) => {
  const { loginId, password } = ctx.body as { loginId?: string; password?: string };
  const user = users.find((u) => u.loginId === loginId && u.password === password);

  if (!user) throw mockError(401, 'UNAUTHORIZED', '아이디 또는 비밀번호가 올바르지 않습니다.');

  return { accessToken: issueToken(user.id), expiresIn: 3600, user: toDto(user) };
});

mock('POST', '/auth/signup', (ctx) => {
  const body = ctx.body as Record<string, string>;

  if (users.some((u) => u.loginId === body.loginId)) {
    throw mockError(409, 'DUPLICATE_LOGIN_ID', '이미 사용 중인 아이디입니다.');
  }

  const user: MockUser = {
    id: `u-${users.length + 1}`,
    loginId: body.loginId ?? '',
    password: body.password ?? '',
    name: body.name ?? '',
    phone: body.phone ?? '',
    email: body.email ?? '',
    role: 'USER',
    faceRegistered: false,
    profileImageUrl: null,
    tokenBalance: 0,
  };
  users.push(user);

  return { accessToken: issueToken(user.id), expiresIn: 3600, user: toDto(user) };
});

mock('POST', '/auth/logout', (ctx) => {
  const raw = (ctx.headers.authorization ?? '').replace('Bearer ', '');
  sessions.delete(raw);
  return null;
});

mock('POST', '/auth/refresh', (ctx) => {
  // 목업에서는 기존 토큰이 유효하면 그대로 재발급해 줍니다.
  const user = requireUser(ctx.headers);
  return { accessToken: issueToken(user.id) };
});

/* ── 내 정보 ── */

mock('GET', '/users/me', (ctx) => toDto(requireUser(ctx.headers)));

mock('PATCH', '/users/me/password', (ctx) => {
  const user = requireUser(ctx.headers);
  const { currentPassword, newPassword } = ctx.body as Record<string, string>;

  if (user.password !== currentPassword) {
    throw mockError(400, 'INVALID_PASSWORD', '현재 비밀번호가 올바르지 않습니다.');
  }
  user.password = newPassword ?? user.password;
  return null;
});

mock('DELETE', '/users/me', (ctx) => {
  const user = requireUser(ctx.headers);
  const index = users.indexOf(user);
  if (index >= 0) users.splice(index, 1);
  return null;
});

/* ── 얼굴 등록 ──
   실제로는 이미지를 업로드하고 서버가 임베딩을 저장합니다.
   목업은 "등록됨" 플래그만 세웁니다. */

mock('POST', '/users/me/face', (ctx) => {
  const user = requireUser(ctx.headers);
  user.faceRegistered = true;
  return { faceRegistered: true };
});

mock('DELETE', '/users/me/face', (ctx) => {
  const user = requireUser(ctx.headers);
  user.faceRegistered = false;
  return { faceRegistered: false };
});

/* ── OTP (예매 진입 관문) ──
   플로우차트: 공연 상세 → OTP 인증 → 구역 선택 */

/** 발급된 OTP 통과권. key: `${userId}:${scheduleId}` */
export const otpPasses = new Set<string>();

mock('POST', '/auth/otp/send', (ctx) => {
  requireUser(ctx.headers);
  const { channel } = ctx.body as { channel?: 'SMS' | 'EMAIL' };

  return {
    channel: channel ?? 'SMS',
    expiresInSeconds: 180,
    // 목업 전용 힌트. 실제 서버는 절대 코드를 내려주지 않습니다.
    hint: MOCK_OTP_CODE,
  };
});

mock('POST', '/auth/otp/verify', (ctx) => {
  const user = requireUser(ctx.headers);
  const { code, scheduleId } = ctx.body as { code?: string; scheduleId?: string };

  if (code !== MOCK_OTP_CODE) {
    throw mockError(400, 'INVALID_OTP', '인증번호가 올바르지 않습니다.');
  }

  otpPasses.add(`${user.id}:${scheduleId ?? ''}`);
  return { verified: true };
});

/** 예매 관련 핸들러가 OTP 통과 여부를 확인할 때 씁니다. */
export function requireOtp(userId: string, scheduleId: string) {
  if (!otpPasses.has(`${userId}:${scheduleId}`)) {
    throw mockError(403, 'OTP_REQUIRED', '본인 인증이 필요합니다.');
  }
}
