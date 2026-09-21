/**
 * 포토카드 뒤집기(짝 맞추기) — 순수 규칙.
 *
 * React 를 모릅니다. 상태 전이는 `hooks/useMemoryGame` 이 합니다.
 */

/** 한 변의 칸 수. 4×4 = 16장 = 8쌍 */
export const GRID_SIZE = 4;
export const CARD_COUNT = GRID_SIZE * GRID_SIZE;
export const PAIR_COUNT = CARD_COUNT / 2;

/**
 * 8쌍의 그림 시드.
 *
 * 🔴 **일부러 시드 기반 SVG(`PocaArt`)를 씁니다 — 네트워크를 타지 않습니다.**
 * 진짜 포토카드 그림은 IPFS 게이트웨이 주소라(`nft_photocard_designs.image_url`)
 * 판을 한 번 깔 때마다 원격 이미지를 **8장** 받아야 하고, 게이트웨이가 느린 날에는
 * 카드가 하나씩 뒤늦게 채워집니다. 뒤집기 게임에서 그림이 늦게 뜨는 것은
 * 느린 정도가 아니라 **정답이 보이는 버그**입니다.
 *
 * 시드는 hue 가 38° 이상 벌어지도록 골랐습니다(`PocaArt` 의 `hashOf(seed) % 360`).
 * 비슷한 색이 섞이면 짝을 눈이 아니라 운으로 찾게 됩니다.
 * 바꿀 때는 색이 겹치지 않는지 확인하세요.
 */
export const CARD_SEEDS = [
  'catmoney-poca-0', // hue 27
  'catmoney-poca-160', // hue 70
  'catmoney-poca-10', // hue 124
  'catmoney-poca-27', // hue 162
  'catmoney-poca-40', // hue 217
  'catmoney-poca-57', // hue 255
  'catmoney-poca-70', // hue 310
  'catmoney-poca-87', // hue 348
] as const;

export interface MemoryCard {
  /** 판 안에서만 유일한 번호. 같은 그림이라도 두 장은 서로 다른 id 입니다 */
  id: number;
  /** 짝 번호 — 이 값이 같은 두 장이 한 쌍 */
  pairId: number;
  /** `PocaArt` 에 넘길 그림 시드 (imageUrl 이 없을 때만 쓰입니다) */
  seed: string;
  /** 실제 포토카드 그림. 없으면 시드 기반 SVG 로 그립니다 */
  imageUrl: string | null;
}

/** 한 쌍이 쓸 그림 */
export interface DeckArt {
  seed: string;
  imageUrl: string;
}

/** `pickDeckArt` 에 넘길 후보 — 내 포카·마켓 목록 항목이 그대로 들어맞습니다 */
export interface ArtCandidate {
  designName: string;
  imageUrl: string | null;
}

/**
 * 후보에서 서로 다른 그림 8종을 고릅니다.
 *
 * 🔴 **8종을 못 채우면 아예 안 씁니다**(빈 배열 → 전부 시드 SVG). 반만 진짜 그림이면
 * 두 가지 화풍이 한 판에 섞여 "덜 만든 화면" 으로 보이고, 무엇보다 **진짜 그림 쪽이
 * 눈에 띄어 짝을 찾기 쉬워집니다** — 카드마다 난이도가 달라지는 셈입니다.
 *
 * 같은 도안이 여러 장 있을 수 있으므로 그림 주소로 중복을 거릅니다
 * (발행 직후 카드는 `imageUrl` 이 null 이라 함께 걸러집니다).
 */
export function pickDeckArt(candidates: ArtCandidate[]): DeckArt[] {
  const seen = new Set<string>();
  const picked: DeckArt[] = [];

  for (const candidate of candidates) {
    const { imageUrl } = candidate;
    if (!imageUrl || seen.has(imageUrl)) continue;
    seen.add(imageUrl);
    picked.push({ seed: candidate.designName, imageUrl });
    if (picked.length === PAIR_COUNT) break;
  }

  return picked.length === PAIR_COUNT ? picked : [];
}

export type MemoryStatus = 'idle' | 'playing' | 'cleared' | 'gaveup';

/**
 * 한 판(16장)을 만들어 섞습니다.
 *
 * `art` 가 8종이면 실제 포토카드 그림으로, 비어 있으면 시드 SVG 로 깝니다.
 * 🔴 `art` 는 **미리 받아 둔 그림**이어야 합니다 — 뒤집는 중에 그림이 뒤늦게 뜨면
 * 뒤집기 게임에서는 느린 정도가 아니라 **정답이 보이는 버그**입니다
 * (`useMemoryArt` 가 다 받은 뒤에만 내줍니다).
 */
export function createDeck(art: DeckArt[] = []): MemoryCard[] {
  const deck: MemoryCard[] = [];
  for (let pairId = 0; pairId < PAIR_COUNT; pairId += 1) {
    const chosen = art[pairId];
    const seed = chosen?.seed ?? CARD_SEEDS[pairId] ?? CARD_SEEDS[0];
    const imageUrl = chosen?.imageUrl ?? null;
    deck.push({ id: pairId * 2, pairId, seed, imageUrl });
    deck.push({ id: pairId * 2 + 1, pairId, seed, imageUrl });
  }
  return shuffle(deck);
}

/** 피셔–예이츠. 정렬 비교자에 난수를 넣는 방식은 고르게 섞이지 않습니다 */
export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * 클리어 시간 → 캣머니 등급.
 *
 * 🔴 **아직 지급하지 않습니다.** 임시 기능이라 화면에 등급만 보여주고
 * 실제 적립(서버 API·`tokenKeys.balance()` 무효화)은 붙이지 않았습니다.
 * 붙일 때는 **서버가 시간을 재고 서버가 금액을 정해야** 합니다 —
 * 프론트가 잰 시간을 믿으면 콘솔에서 0초 클리어를 만들 수 있습니다.
 * (CLAUDE.md 7장 결제 — 금액의 출처는 항상 서버)
 */
export const REWARD_TIERS = [
  { withinSeconds: 30, reward: 5 },
  { withinSeconds: 45, reward: 4 },
  { withinSeconds: 60, reward: 3 },
  { withinSeconds: 90, reward: 2 },
  { withinSeconds: Infinity, reward: 1 },
] as const;

export function rewardFor(elapsedMs: number): number {
  const seconds = elapsedMs / 1000;
  return REWARD_TIERS.find((tier) => seconds <= tier.withinSeconds)?.reward ?? 1;
}

/**
 * 경과 시간 표기 — `01:07.4` (분:초.십분의일).
 *
 * `shared/lib` 의 `formatDuration` 은 좌석 선점 카운트다운용이라 초까지만 보여줍니다.
 * 기록을 다투는 화면에서는 십분의 일 자리가 있어야 시간이 흐르는 것이 보입니다.
 */
export function formatClock(ms: number): string {
  const total = Math.max(0, ms);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const tenths = Math.floor((total % 1000) / 100);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}
