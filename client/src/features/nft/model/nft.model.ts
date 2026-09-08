import type {
  PhotocardDetail,
  PhotocardMintStatus,
  PhotocardOrigin,
  PhotocardTrade,
  PurchaseHistory,
  SaleHistory,
} from './nft.types';

/**
 * 마켓 정렬.
 *
 * 정렬은 **서버가** 합니다. 받아온 목록만 프론트에서 정렬하면
 * 페이지네이션이 붙는 순간 "이 페이지 안에서만" 정렬됩니다.
 * 값은 서버 `NftMarketSort` 와 같습니다.
 */
export const NFT_SORTS = [
  { value: 'RECENT', label: '최신순' },
  { value: 'PRICE_ASC', label: '낮은 가격순' },
  { value: 'PRICE_DESC', label: '높은 가격순' },
] as const;

export type NftSort = (typeof NFT_SORTS)[number]['value'];

export const DEFAULT_SORT: NftSort = 'RECENT';

export function isListed(detail: PhotocardDetail): boolean {
  return detail.listing !== null && detail.listing !== undefined;
}

/**
 * 내 포카인가 — **닉네임 비교**.
 *
 * 상세 응답에 소유자 id 가 없어 `ownerNickname` 으로 판정합니다.
 * 닉네임은 서버에서 유니크(`uq_users_nickname_active`)라 동작하지만,
 * 서버가 `viewer.isOwner` 를 주기 시작하면 **이 함수 하나만** 바꾸면 됩니다.
 * 화면은 이 함수만 부르고 닉네임을 직접 비교하지 않습니다.
 */
export function isOwner(detail: PhotocardDetail, viewerNickname: string | undefined): boolean {
  return !!viewerNickname && detail.ownerNickname === viewerNickname;
}

/** 내가 이 포카를 살 수 있는가 */
export function canPurchase(
  detail: PhotocardDetail,
  viewerNickname: string | undefined,
  balance: number,
): boolean {
  return (
    isListed(detail) && !isOwner(detail, viewerNickname) && balance >= (detail.listing?.price ?? 0)
  );
}

/**
 * 구매·판매 내역을 한 목록으로.
 * 서버는 둘을 따로 주지만 "이 카드를 얼마에 샀더라" 를 찾는 화면에서는 한 줄기로 보는 게 빠릅니다.
 * 같은 형식의 시각 문자열이라 사전순이 곧 시간순입니다.
 */
export function mergeTrades(purchases: PurchaseHistory[], sales: SaleHistory[]): PhotocardTrade[] {
  const bought: PhotocardTrade[] = purchases.map((p) => ({
    tradeId: p.tradeId,
    photocardId: p.photocardId,
    designName: p.designName,
    imageUrl: p.imageUrl,
    type: 'BUY',
    price: p.price,
    tradedAt: p.tradedAt,
    counterpartyNickname: p.sellerNickname,
  }));
  const sold: PhotocardTrade[] = sales.map((s) => ({
    tradeId: s.tradeId,
    photocardId: s.photocardId,
    designName: s.designName,
    imageUrl: s.imageUrl,
    type: 'SELL',
    price: s.price,
    tradedAt: s.tradedAt,
    counterpartyNickname: s.buyerNickname,
  }));
  return [...bought, ...sold].sort((a, b) => b.tradedAt.localeCompare(a.tradedAt));
}

/** `PocaArt` 시드 — 실제 이미지(`imageUrl`)가 없을 때 그림을 만드는 값 */
export function pocaSeed(photocardId: number): string {
  return `poca-${photocardId}`;
}

/** 'VIP석 A구역 3열 5번' / 스탠딩이면 'VIP석 A구역 스탠딩' */
export function formatOrigin(origin: PhotocardOrigin): string {
  const grade = origin.seatGrade.endsWith('석') ? origin.seatGrade : `${origin.seatGrade}석`;
  const seat =
    origin.rowLabel !== null && origin.seatNumber !== null
      ? `${origin.rowLabel}열 ${origin.seatNumber}번`
      : '스탠딩';
  return `${grade} ${origin.areaCode}구역 ${seat}`;
}

/** 발행이 끝나지 않은 카드에만 한 줄. MINTED 면 null (아무것도 안 보임) */
export function mintStatusLabel(status: PhotocardMintStatus): string | null {
  if (status === 'MINTED') return null;
  if (status === 'FAILED') return '발행 실패';
  return '발행 처리 중';
}
