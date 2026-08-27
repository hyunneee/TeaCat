import type { Nft, Rarity } from './nft.types';

export const RARITY_LABEL: Record<Rarity, string> = {
  NORMAL: 'NORMAL',
  RARE: 'RARE',
  SPECIAL: 'SPECIAL',
};

/** 등급별 색. styles/index.css 의 --color-rarity-* 와 짝입니다. */
export const RARITY_CLASS: Record<Rarity, string> = {
  NORMAL: 'text-rarity-normal',
  RARE: 'text-rarity-rare',
  SPECIAL: 'text-rarity-special',
};

export function rarityTone(rarity: Rarity) {
  if (rarity === 'SPECIAL') return 'warning' as const;
  if (rarity === 'RARE') return 'info' as const;
  return 'neutral' as const;
}

export function isListed(nft: Nft): boolean {
  return nft.listPrice !== null;
}

/** 내가 이 포카를 살 수 있는가 */
export function canPurchase(nft: Nft, myUserId: string | undefined, balance: number): boolean {
  return isListed(nft) && nft.ownerId !== myUserId && balance >= (nft.listPrice ?? 0);
}
