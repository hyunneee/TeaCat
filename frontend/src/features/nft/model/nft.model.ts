import type { Nft, Rarity } from './nft.types';

export const RARITY_LABEL: Record<Rarity, string> = {
  NORMAL: 'NORMAL',
  RARE: 'RARE',
  SPECIAL: 'SPECIAL',
};

/**
 * 등급별 표시 규칙 — **여기 한 줄만 고치면** 목록·상세·뱃지가 함께 바뀝니다.
 *
 * 실제 색은 `styles/index.css` 의 `--color-rarity-*` 에 있습니다.
 * 등급이 늘어나면 `Rarity` 에 값을 추가하고 이 테이블에 한 줄을 더하면
 * 나머지는 타입 에러가 잡아줍니다.
 */
export interface RarityStyle {
  /** 글자색 */
  text: string;
  /** 아트 테두리 (PocaArt) */
  ring: string;
  /** 뱃지 배경·글자 */
  badge: string;
}

export const RARITY_STYLE: Record<Rarity, RarityStyle> = {
  NORMAL: {
    text: 'text-rarity-normal',
    ring: 'ring-2 ring-rarity-normal/70',
    badge: 'bg-rarity-normal/12 text-rarity-normal border-rarity-normal/35',
  },
  RARE: {
    text: 'text-rarity-rare',
    ring: 'ring-2 ring-rarity-rare/75',
    badge: 'bg-rarity-rare/12 text-rarity-rare border-rarity-rare/35',
  },
  SPECIAL: {
    text: 'text-rarity-special',
    ring: 'ring-[3px] ring-rarity-special',
    badge: 'bg-rarity-special/12 text-rarity-special border-rarity-special/40',
  },
};

/** 이전 이름 — 새 코드는 RARITY_STYLE 을 쓰세요. */
export const RARITY_CLASS: Record<Rarity, string> = {
  NORMAL: RARITY_STYLE.NORMAL.text,
  RARE: RARITY_STYLE.RARE.text,
  SPECIAL: RARITY_STYLE.SPECIAL.text,
};

export function isListed(nft: Nft): boolean {
  return nft.listPrice !== null;
}

/** 내가 이 포카를 살 수 있는가 */
export function canPurchase(nft: Nft, myUserId: string | undefined, balance: number): boolean {
  return isListed(nft) && nft.ownerId !== myUserId && balance >= (nft.listPrice ?? 0);
}
