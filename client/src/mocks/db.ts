/**
 * 목업용 인메모리 데이터베이스.
 *
 * 새로고침하면 초기화됩니다. (그게 목적입니다 — 항상 같은 화면에서 시작)
 * 실제 백엔드가 붙으면 이 파일과 handlers 폴더는 통째로 사라집니다.
 */

/* ── 결정론적 난수 ──────────────────────────────────────────
   Math.random 을 쓰면 새로고침할 때마다 좌석 배치가 바뀌어서
   "아까 그 좌석" 을 다시 못 찾습니다. 문자열 해시로 고정합니다. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/* ─────────────────────────── 타입 ─────────────────────────── */

export interface MockUser {
  id: string;
  loginId: string;
  password: string;
  name: string;
  /** 표시 이름. 포카 소유 판정(ownerNickname 비교)에 쓰이므로 실서버 User.nickname 과 같은 뜻 */
  nickname: string;
  phone: string;
  email: string;
  role: 'USER' | 'ORGANIZER' | 'ADMIN';
  faceRegistered: boolean;
  profileImageUrl: string | null;
  tokenBalance: number;
}

export interface MockVenue {
  id: string;
  name: string;
  address: string;
}

export interface MockConcert {
  id: string;
  title: string;
  artist: string;
  venueId: string;
  /** 포스터가 없으면 이 시드로 그라데이션을 만듭니다 (외부 이미지 요청 없음) */
  posterSeed: string;
  genre: string;
  runningMinutes: number;
  ageLimit: string;
  description: string;
  openAt: string;
}

export interface MockSchedule {
  id: string;
  concertId: string;
  startAt: string;
  /** 예매 오픈 시각 */
  openAt: string;
  maxPerUser: number;
}

export interface MockSection {
  id: string;
  scheduleId: string;
  name: string;
  grade: string;
  price: number;
  /** 좌석맵 블록 배치 */
  origin: { x: number; y: number };
  cols: number;
  rows: number;
}

export interface MockSeat {
  id: string;
  scheduleId: string;
  sectionId: string;
  row: string;
  number: number;
  price: number;
  status: 'AVAILABLE' | 'HELD' | 'SOLD' | 'BLOCKED';
  x: number;
  y: number;
  /** 누가 잡고 있는지 (HELD) / 누가 샀는지 (SOLD) */
  ownerId: string | null;
}

export interface MockTicket {
  id: string;
  orderId: string;
  userId: string;
  scheduleId: string;
  seatId: string;
  ownerName: string;
  status: 'VALID' | 'CANCELED' | 'USED';
  price: number;
  issuedAt: string;
}

/* ─────────────────────────── 시드 ─────────────────────────── */

const DAY = 86_400_000;
/** 목업 기준 시각. 실행 시점 기준으로 상대 계산합니다. */
const now = () => Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

export const users: MockUser[] = [
  {
    id: 'u-1',
    loginId: 'ssafy',
    password: 'ssafy1234',
    name: '김싸피',
    nickname: '김싸피',
    phone: '010-1234-5678',
    email: 'ssafy@example.com',
    role: 'USER',
    faceRegistered: false,
    profileImageUrl: null,
    tokenBalance: 8400,
  },
  {
    id: 'u-2',
    loginId: 'admin',
    password: 'admin1234',
    name: '관리자',
    nickname: '관리자',
    phone: '010-0000-0000',
    email: 'admin@example.com',
    role: 'ADMIN',
    faceRegistered: true,
    profileImageUrl: null,
    tokenBalance: 0,
  },
  {
    id: 'u-3',
    loginId: 'friend',
    password: 'friend1234',
    name: '이친구',
    nickname: '이친구',
    phone: '010-9999-8888',
    email: 'friend@example.com',
    role: 'USER',
    faceRegistered: true,
    profileImageUrl: null,
    tokenBalance: 350,
  },
];

export const venues: MockVenue[] = [
  { id: 'v-1', name: '고척스카이돔', address: '서울 구로구 경인로 430' },
  { id: 'v-2', name: 'KSPO DOME', address: '서울 송파구 올림픽로 424' },
  { id: 'v-3', name: '부산 벡스코 오디토리움', address: '부산 해운대구 APEC로 55' },
];

export const concerts: MockConcert[] = [
  {
    id: 'c-1',
    title: 'PURPLE WAVE 2026',
    artist: 'VIOLETTA',
    venueId: 'v-1',
    posterSeed: 'purple-wave',
    genre: '콘서트',
    runningMinutes: 150,
    ageLimit: '만 7세 이상',
    description:
      '보랏빛 파도가 고척을 뒤덮는다. VIOLETTA 단독 콘서트 PURPLE WAVE 2026.\n전 좌석 스탠딩 없이 지정석으로 진행됩니다.',
    openAt: iso(now() - 2 * DAY),
  },
  {
    id: 'c-2',
    title: 'MIDNIGHT SIGNAL',
    artist: 'NIGHTFALL',
    venueId: 'v-2',
    posterSeed: 'midnight',
    genre: '콘서트',
    runningMinutes: 120,
    ageLimit: '만 12세 이상',
    description: '새벽 2시의 신호. NIGHTFALL 첫 단독 공연.',
    openAt: iso(now() - 1 * DAY),
  },
  {
    id: 'c-3',
    title: '고척 캣머니 페스티벌',
    artist: 'V.A.',
    venueId: 'v-1',
    posterSeed: 'grape',
    genre: '페스티벌',
    runningMinutes: 300,
    ageLimit: '전체 관람가',
    description:
      '고척돔에서 캣머니 찾기. 전 좌석에 시크릿 포토카드가 숨겨져 있습니다.\n단 한 장뿐인 스페셜 포카의 주인공은 누구일까요?',
    openAt: iso(now() - 3 * DAY),
  },
  {
    id: 'c-4',
    title: 'ENCORE : LAST PAGE',
    artist: 'LAST PAGE',
    venueId: 'v-3',
    posterSeed: 'lastpage',
    genre: '콘서트',
    runningMinutes: 140,
    ageLimit: '만 15세 이상',
    description: '마지막 장을 함께 넘겨주세요.',
    openAt: iso(now() + 5 * DAY),
  },
  {
    id: 'c-5',
    title: 'SUMMER BLOOM',
    artist: 'BLOOMING',
    venueId: 'v-2',
    posterSeed: 'bloom',
    genre: '콘서트',
    runningMinutes: 110,
    ageLimit: '전체 관람가',
    description: '여름의 한가운데에서 피어나는 무대.',
    openAt: iso(now() + 9 * DAY),
  },
];

export const schedules: MockSchedule[] = [
  {
    id: 's-1',
    concertId: 'c-1',
    startAt: iso(now() + 12 * DAY),
    openAt: iso(now() - 2 * DAY),
    maxPerUser: 1,
  },
  {
    id: 's-2',
    concertId: 'c-1',
    startAt: iso(now() + 13 * DAY),
    openAt: iso(now() - 2 * DAY),
    maxPerUser: 1,
  },
  {
    id: 's-3',
    concertId: 'c-2',
    startAt: iso(now() + 20 * DAY),
    openAt: iso(now() - 1 * DAY),
    maxPerUser: 1,
  },
  {
    id: 's-4',
    concertId: 'c-3',
    startAt: iso(now() + 30 * DAY),
    openAt: iso(now() - 3 * DAY),
    maxPerUser: 1,
  },
  {
    id: 's-5',
    concertId: 'c-4',
    startAt: iso(now() + 40 * DAY),
    openAt: iso(now() + 5 * DAY),
    maxPerUser: 1,
  },
  {
    id: 's-6',
    concertId: 'c-5',
    startAt: iso(now() + 55 * DAY),
    openAt: iso(now() + 9 * DAY),
    maxPerUser: 1,
  },
];

/** 구역 템플릿 — 모든 회차가 같은 공연장 배치를 씁니다 (목업이므로) */
const SECTION_TEMPLATE = [
  { name: 'VIP석', grade: 'VIP', price: 165_000, origin: { x: 390, y: 120 }, cols: 11, rows: 6 },
  { name: 'R석 A', grade: 'R', price: 143_000, origin: { x: 140, y: 120 }, cols: 8, rows: 8 },
  { name: 'R석 B', grade: 'R', price: 143_000, origin: { x: 700, y: 120 }, cols: 8, rows: 8 },
  { name: 'S석', grade: 'S', price: 121_000, origin: { x: 250, y: 330 }, cols: 24, rows: 7 },
] as const;

export const sections: MockSection[] = schedules.flatMap((schedule) =>
  SECTION_TEMPLATE.map((tpl, i) => ({
    id: `${schedule.id}-sec-${i + 1}`,
    scheduleId: schedule.id,
    name: tpl.name,
    grade: tpl.grade,
    price: tpl.price,
    origin: { ...tpl.origin },
    cols: tpl.cols,
    rows: tpl.rows,
  })),
);

const SEAT_STEP = 20;

export const seats: MockSeat[] = sections.flatMap((section) => {
  const result: MockSeat[] = [];

  for (let r = 0; r < section.rows; r += 1) {
    for (let c = 0; c < section.cols; c += 1) {
      const id = `${section.id}-${r + 1}-${c + 1}`;
      const roll = hash(id);

      // 인기 공연 느낌을 내려고 일부는 미리 팔린 상태로 둡니다.
      let status: MockSeat['status'] = 'AVAILABLE';
      if (roll < 0.28) status = 'SOLD';
      else if (roll < 0.32) status = 'HELD';
      else if (roll < 0.335) status = 'BLOCKED';

      result.push({
        id,
        scheduleId: section.scheduleId,
        sectionId: section.id,
        row: String(r + 1),
        number: c + 1,
        price: section.price,
        status,
        x: section.origin.x + c * SEAT_STEP,
        y: section.origin.y + r * SEAT_STEP,
        ownerId: status === 'SOLD' ? 'u-3' : null,
      });
    }
  }
  return result;
});

export const tickets: MockTicket[] = [
  {
    id: 't-1',
    orderId: 'o-1',
    userId: 'u-1',
    scheduleId: 's-3',
    seatId: 's-3-sec-1-2-4',
    ownerName: '김싸피',
    status: 'VALID',
    price: 165_000,
    issuedAt: iso(now() - 3 * DAY),
  },
];

/* 취소표 대기는 실서버로 넘어갔습니다 (2026-09-21). handlers/resale.ts 와 함께 목업 데이터를 지웠습니다 */
/* ── 세션 (목업용 아주 단순한 토큰 저장소) ── */
export const sessions = new Map<string, string>(); // accessToken -> userId

/* ── 조회 헬퍼 ── */
export const findUser = (id: string) => users.find((u) => u.id === id);
export const findConcert = (id: string) => concerts.find((c) => c.id === id);
export const findSchedule = (id: string) => schedules.find((s) => s.id === id);
export const findVenue = (id: string) => venues.find((v) => v.id === id);
export const findSeat = (id: string) => seats.find((s) => s.id === id);

/**
 * 실서버 로그인 사용자 → 시연용 사용자(u-1) 닉네임 동기화.
 * JWT 에는 userId·role 만 있어서, `GET /users/me` 응답이 목업 어댑터를 지나갈 때
 * 어댑터가 이 함수를 불러 닉네임을 이어 붙입니다. 상세의 `ownerNickname` 과
 * 화면의 `user.nickname` 이 같아져 "내 카드" 판정이 맞습니다. (목업 전용)
 */
export const bridgeDemoNickname = (nickname: string) => {
  const demo = users[0];
  if (demo && nickname) demo.nickname = nickname;
};

export const userFromToken = (token: string | undefined) => {
  if (!token) return undefined;

  const bySession = findUser(sessions.get(token) ?? '');
  if (bySession) return bySession;

  // HMR/dev 서버 재시작으로 sessions 맵이 비어도 로그인이 유지되도록
  // 토큰 문자열에서 userId 를 복원합니다. (목업 전용 편의 기능)
  const matched = /^mock-access-(.+)-\d+$/.exec(token);
  const restored = matched ? findUser(matched[1] ?? '') : undefined;
  if (restored) sessions.set(token, restored.id);
  return restored;
};

/**
 * 목업이 심은 시각 문자열 → epoch ms.
 * 목업은 `toISOString()`(Z)을 쓰고 실서버는 타임존 없는 KST 를 줍니다.
 * 핸들러가 두 형태를 같은 방식으로 비교하도록 프론트와 같은 규칙을 씁니다.
 */
export const parseTime = (value: string): number => {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasZone ? value : `${value}+09:00`).getTime();
};

export { iso, DAY, now };
