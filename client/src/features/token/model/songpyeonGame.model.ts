/**
 * 송편 잡기 — 순수 규칙.
 *
 * React 를 모릅니다. 상태 전이는 `hooks/useSongpyeonGame` 이 합니다.
 *
 * ── 규칙 ────────────────────────────────────────────────
 * 판에 송편과 다른 것들이 번갈아 떴다 사라집니다. **송편을 잡으면** 다음 단계,
 * **송편이 아닌 것을 잡거나 10초를 넘기면** 그 자리에서 끝나고 1단계부터 다시 합니다.
 * 5단계까지 통과하면 하루 한 번 캣머니를 받습니다(금액은 서버가 정합니다).
 *
 * 🔴 **난이도는 "속도" 하나로만 올립니다.** 단계가 오를수록 조각이 더 자주 나오고 더 빨리
 * 사라집니다. 송편이 나올 확률이나 방해물 종류는 단계와 무관합니다 — 확률까지 같이 낮추면
 * 5단계는 실력이 아니라 운이 됩니다.
 */

/** 통과해야 하는 단계 수 */
export const STAGE_COUNT = 5;

/** 한 단계에 주어지는 시간(ms). 단계가 올라도 이 값은 그대로입니다 */
export const STAGE_MS = 10_000;

/**
 * 단계별 속도.
 *
 * `spawnMs` 는 새 조각이 나오는 간격, `lifetimeMs` 는 한 조각이 떠 있는 시간입니다.
 * 🔴 `lifetimeMs` 는 항상 `spawnMs` 보다 넉넉히 큽니다 — 작으면 판이 자주 텅 비어서
 * "어려운" 게 아니라 "기다리는" 게임이 됩니다.
 *
 * 5단계의 0.52초는 **눌러서 반응할 수 있는 하한**으로 잡았습니다. 손가락이 화면까지 가는
 * 시간이 있어 이보다 짧으면 봐도 못 누릅니다.
 */
export interface StageSpec {
  spawnMs: number;
  lifetimeMs: number;
}

export const STAGES: readonly StageSpec[] = [
  { spawnMs: 760, lifetimeMs: 1500 },
  { spawnMs: 640, lifetimeMs: 1200 },
  { spawnMs: 540, lifetimeMs: 950 },
  { spawnMs: 450, lifetimeMs: 740 },
  { spawnMs: 380, lifetimeMs: 580 },
] as const;

export function stageSpec(stage: number): StageSpec {
  return STAGES[Math.min(Math.max(stage, 1), STAGE_COUNT) - 1] ?? STAGES[0]!;
}

/**
 * 판에 뜨는 것들.
 *
 * 송편 하나와 방해물들입니다. 방해물은 **모양으로만** 구분됩니다 — 색으로 나누지 않습니다
 * (CLAUDE.md 4-6: 초록은 "지금 눌러야 할 것" 자리라, 송편만 초록으로 칠하면 모양을 볼 필요가
 * 없어져 게임이 사라집니다). 그래서 전부 같은 색으로 그리고 눈이 모양을 찾게 합니다.
 */
export type PieceKind = 'songpyeon' | 'chestnut' | 'jujube' | 'pear' | 'persimmon' | 'yakgwa';

/** 방해물. 송편과 크기가 비슷하고 둥근 것들로 골랐습니다 — 한눈에 갈리면 게임이 아닙니다 */
export const DECOY_KINDS: readonly PieceKind[] = [
  'chestnut',
  'jujube',
  'pear',
  'persimmon',
  'yakgwa',
] as const;

/** 읽는 이(스크린리더)에게 들려줄 이름 */
export const PIECE_LABEL: Record<PieceKind, string> = {
  songpyeon: '송편',
  chestnut: '밤',
  jujube: '대추',
  pear: '배',
  persimmon: '감',
  yakgwa: '약과',
};

/** 판에 떠 있는 조각 하나 */
export interface Piece {
  /** 판 전체에서 유일한 번호 */
  id: number;
  kind: PieceKind;
  /** 판 안에서의 위치(%). 조각 크기를 고려해 가장자리를 비워 둡니다 */
  xPct: number;
  yPct: number;
  /** 나타난 시각(ms) */
  bornAt: number;
  /** 사라질 시각(ms) */
  diesAt: number;
}

/** 한 번 나올 때 송편일 확률. 단계와 무관하게 고정입니다 */
const SONGPYEON_CHANCE = 0.34;

/**
 * 송편이 이 시간(ms) 넘게 안 나왔으면 다음 조각은 무조건 송편.
 *
 * 🔴 확률에만 맡기면 10초 동안 한 번도 안 나오는 판이 드물게 생깁니다. 잘해도 지는 판은
 * 게임이 아니라 버그로 읽힙니다. 단계 시간(10초)보다 훨씬 짧게 잡아 늘 기회가 있게 합니다.
 */
const SONGPYEON_GAP_MS = 2400;

export type SongpyeonStatus = 'idle' | 'playing' | 'failed' | 'cleared';

/** 왜 끝났는가 — 끝난 화면의 문구가 갈립니다 */
export type FailReason = 'wrong' | 'timeout';

/**
 * 왜 끝났는지 한 줄로.
 *
 * 둘을 "실패했어요" 로 뭉치지 않습니다 — 잘못 눌러서 끝난 것과 시간이 다 된 것은
 * 다음 판에서 고쳐야 할 것이 다릅니다.
 */
export function failMessage(reason: FailReason): string {
  return reason === 'wrong' ? '송편이 아니었어요!' : '10초가 다 됐어요!';
}

export interface SpawnInput {
  now: number;
  /** 마지막으로 송편이 나온 시각. 아직 없으면 단계 시작 시각 */
  lastSongpyeonAt: number;
  lifetimeMs: number;
  nextId: number;
  /** 겹치지 않게 피할 자리들 */
  taken: readonly Piece[];
}

/**
 * 조각 하나를 만듭니다.
 *
 * 자리는 이미 떠 있는 조각과 겹치지 않게 몇 번 다시 뽑습니다. 겹치면 어느 쪽을 눌렀는지
 * 사용자도 모르고, 방해물을 누른 것으로 끝나면 억울한 패배가 됩니다.
 */
export function spawnPiece(input: SpawnInput): Piece {
  const { now, lastSongpyeonAt, lifetimeMs, nextId, taken } = input;

  const forced = now - lastSongpyeonAt >= SONGPYEON_GAP_MS;
  const kind: PieceKind =
    forced || Math.random() < SONGPYEON_CHANCE ? 'songpyeon' : pickDecoy();

  const { xPct, yPct } = pickSpot(taken);
  return { id: nextId, kind, xPct, yPct, bornAt: now, diesAt: now + lifetimeMs };
}

function pickDecoy(): PieceKind {
  return DECOY_KINDS[Math.floor(Math.random() * DECOY_KINDS.length)] ?? 'chestnut';
}

/** 조각 반지름을 % 로 친 값. 이보다 가까우면 겹쳐 보입니다 */
const MIN_GAP_PCT = 22;
/** 가장자리 여백(%). 0~100 그대로 쓰면 조각이 판 밖으로 절반 나갑니다 */
const EDGE_PCT = 10;
const SPOT_TRIES = 12;

function pickSpot(taken: readonly Piece[]): { xPct: number; yPct: number } {
  let fallback = randomSpot();

  for (let i = 0; i < SPOT_TRIES; i += 1) {
    const spot = randomSpot();
    const clear = taken.every(
      (piece) => Math.hypot(piece.xPct - spot.xPct, piece.yPct - spot.yPct) >= MIN_GAP_PCT,
    );
    if (clear) return spot;
    fallback = spot;
  }

  /* 자리가 없으면 마지막으로 뽑은 자리에 그냥 둡니다. 여기서 포기하고 안 만들면
     판이 비는데, 판이 비는 쪽이 겹쳐 보이는 쪽보다 나쁩니다 */
  return fallback;
}

function randomSpot() {
  const span = 100 - EDGE_PCT * 2;
  return {
    xPct: EDGE_PCT + Math.random() * span,
    yPct: EDGE_PCT + Math.random() * span,
  };
}

export { SONGPYEON_CHANCE, SONGPYEON_GAP_MS };
