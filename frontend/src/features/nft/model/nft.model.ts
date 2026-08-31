import type { Nft } from './nft.types';

/**
 * 마켓 정렬.
 *
 * 정렬은 **서버가** 합니다. 받아온 목록만 프론트에서 정렬하면
 * 페이지네이션이 붙는 순간 "이 페이지 안에서만" 정렬됩니다.
 * 옵션을 늘리려면 이 테이블에 한 줄, 서버 핸들러에 한 줄입니다.
 */
export const NFT_SORTS = [
  { value: 'RECENT', label: '최신순' },
  { value: 'PRICE_ASC', label: '낮은 가격순' },
  { value: 'PRICE_DESC', label: '높은 가격순' },
] as const;

export type NftSort = (typeof NFT_SORTS)[number]['value'];

export const DEFAULT_SORT: NftSort = 'RECENT';

export function isListed(nft: Nft): boolean {
  return nft.listPrice !== null;
}

/** 내가 이 포카를 살 수 있는가 */
export function canPurchase(nft: Nft, myUserId: string | undefined, balance: number): boolean {
  return isListed(nft) && nft.ownerId !== myUserId && balance >= (nft.listPrice ?? 0);
}
