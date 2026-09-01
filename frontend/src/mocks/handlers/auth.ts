import { mock, mockError } from '../router';
import { sessions, users, userFromToken, type MockUser } from '../db';

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

/* ── 자동입력 방지 (예매 진입 관문) ──
   플로우차트: 공연 상세 → 봇 확인 → 구역 선택

   휴대폰 인증번호가 아니라 **캡차**입니다. 여기서 걸러내려는 건
   "본인인지" 가 아니라 "사람인지" 이기 때문입니다.
   실서버도 계약은 같습니다 — 그림을 내려주고, 정답은 서버만 압니다. */

/** 헷갈리는 글자는 뺍니다 (0/O, 1/I/l) */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CAPTCHA_LENGTH = 5;
const CAPTCHA_TTL_MS = 3 * 60 * 1000;

interface Challenge {
  answer: string;
  expiresAt: number;
}

/** challengeId → 정답. 실서버라면 Redis 에 TTL 과 함께 둡니다. */
const challenges = new Map<string, Challenge>();

const pick = (list: string): string => list[Math.floor(Math.random() * list.length)] as string;
const between = (min: number, max: number) => min + Math.random() * (max - min);
const n = (value: number) => value.toFixed(1);
const gray = (min: number, max: number) => {
  const v = Math.floor(between(min, max));
  return `rgb(${v},${v},${v})`;
};

/**
 * 글자를 하나씩 다르게 기울이고 흔들어 SVG 로 그립니다.
 * 잡음 선·점을 겹쳐 단순 OCR 로는 바로 읽히지 않게 합니다.
 * (실서버라면 이미지 서버가 PNG 를 내려주겠지만 계약은 동일합니다)
 */
function drawCaptcha(answer: string): string {
  const width = 240;
  const height = 84;

  const letters = [...answer]
    .map((char, i) => {
      const x = 28 + i * 42 + between(-4, 4);
      const y = height / 2 + between(-2, 10);
      const rotate = between(-22, 22);
      const size = between(30, 38);
      return `<text x="${n(x)}" y="${n(y)}" font-family="Georgia,serif" font-size="${n(size)}" font-weight="700" fill="${gray(24, 92)}" transform="rotate(${n(rotate)} ${n(x)} ${n(y)})">${char}</text>`;
    })
    .join('');

  const noise = Array.from(
    { length: 6 },
    () =>
      `<path d="M0 ${n(between(8, height - 8))} Q ${n(width / 2)} ${n(between(0, height))} ${width} ${n(between(8, height - 8))}" stroke="${gray(140, 200)}" stroke-width="${n(between(1, 2))}" fill="none"/>`,
  ).join('');

  const dots = Array.from(
    { length: 40 },
    () =>
      `<circle cx="${n(between(0, width))}" cy="${n(between(0, height))}" r="${n(between(0.8, 1.8))}" fill="${gray(150, 210)}"/>`,
  ).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f4f4f4"/>${dots}${noise}${letters}</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 만료된 문제 정리 */
function sweepChallenges() {
  const current = Date.now();
  for (const [id, challenge] of challenges) {
    if (challenge.expiresAt <= current) challenges.delete(id);
  }
}

/** 통과권. key: `userId:scheduleId` */
export const captchaPasses = new Set<string>();

mock('GET', '/auth/captcha', (ctx) => {
  requireUser(ctx.headers);
  sweepChallenges();

  const answer = Array.from({ length: CAPTCHA_LENGTH }, () => pick(ALPHABET)).join('');
  const challengeId = `cap-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  challenges.set(challengeId, { answer, expiresAt: Date.now() + CAPTCHA_TTL_MS });

  // 💡 answer 는 절대 응답에 넣지 않습니다. 넣는 순간 캡차가 아닙니다.
  return {
    challengeId,
    imageDataUrl: drawCaptcha(answer),
    length: CAPTCHA_LENGTH,
    expiresInSeconds: CAPTCHA_TTL_MS / 1000,
  };
});

mock('POST', '/auth/captcha/verify', (ctx) => {
  const user = requireUser(ctx.headers);
  const { challengeId, answer, scheduleId } = ctx.body as {
    challengeId?: string;
    answer?: string;
    scheduleId?: string;
  };

  const challenge = challenges.get(challengeId ?? '');
  // 한 번 쓴 문제는 정답이든 오답이든 버립니다 (재사용·대입 방지)
  challenges.delete(challengeId ?? '');

  if (!challenge || challenge.expiresAt <= Date.now()) {
    throw mockError(400, 'CAPTCHA_EXPIRED', '문제가 만료되었습니다. 새 문제로 다시 시도해 주세요.');
  }
  if ((answer ?? '').trim().toUpperCase() !== challenge.answer) {
    throw mockError(400, 'CAPTCHA_INVALID', '글자가 맞지 않습니다.');
  }

  captchaPasses.add(`${user.id}:${scheduleId ?? ''}`);
  return { verified: true };
});

/** 예매 관련 핸들러가 통과 여부를 확인할 때 씁니다. */
export function requireCaptcha(userId: string, scheduleId: string) {
  if (!captchaPasses.has(`${userId}:${scheduleId}`)) {
    throw mockError(403, 'CAPTCHA_REQUIRED', '자동입력 방지 확인이 필요합니다.');
  }
}
