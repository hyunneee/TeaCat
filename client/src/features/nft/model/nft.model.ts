import { parseServerTime } from '@/shared/lib';
import type {
  MyPhotocard,
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
  { value: 'VIEW_DESC', label: '조회순' },
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

/**
 * 이 카드가 어디서 왔는가 — 목록·상세의 둘째 줄.
 *
 * 뽑기로 얻은 카드는 공연이 없어서 서버가 `performanceTitle` 을 null 로 줍니다.
 * 빈 줄로 두면 카드마다 높이가 달라지고 "왜 여긴 비었지" 가 남습니다.
 */
/**
 * 서버가 도안 이름에 공연 제목을 붙여 둡니다 — `"김예린 · 아기숭이 콘서트"`.
 * 온체인 메타데이터에 박히는 이름이라 **거기서는 그래야 합니다**(같은 사람이라도 공연마다
 * 다른 카드라서 구분이 필요합니다). 화면에서는 앞의 이름만 씁니다 —
 * 목록·상세 모두 공연 이름을 바로 아랫줄에 따로 적고 있어서 두 번 나옵니다.
 */
const NAME_JOINER = ' · ';

export function pocaName(designName: string): string {
  const first = designName.split(NAME_JOINER)[0]?.trim();
  return first || designName;
}

/**
 * 잠긴 카드팩이 열리는 시각 — '9월 20일 19:50'.
 *
 * 🔴 "공연 시작 10분 전" 이라고 적지 않습니다. 그 10분은 서버 설정이라 바뀔 수 있고,
 * 화면이 규칙을 단정하면 그때 거짓말이 됩니다. **시각만** 말합니다.
 */
export function packOpenAtLabel(nextOpenAt: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(parseServerTime(nextOpenAt)));
}

export function photocardSource(performanceTitle: string | null): string {
  return performanceTitle ?? '이벤트 카드팩';
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

/** 같은 도안을 묶은 한 칸 */
export interface PhotocardGroup {
  /** 대표 카드 — 눌렀을 때 이 카드의 상세로 갑니다 */
  card: MyPhotocard;
  /** 같은 도안을 몇 장 갖고 있는지. 1 이면 묶은 것이 아닙니다 */
  count: number;
}

/**
 * 내 포카 목록에서 **같은 도안을 한 칸으로** 묶습니다. 뽑기로 같은 카드가 여러 장 나오면
 * 똑같은 칸이 줄줄이 늘어서서 무엇을 몇 장 가졌는지가 오히려 안 보입니다.
 *
 * 🔴 판매 중과 보관 중은 섞지 않습니다 — 한 칸에 담으면 "판매 중 ×3" 이 거짓말이 됩니다.
 * 서버가 준 순서는 그대로 둡니다(먼저 나온 카드가 그 묶음의 대표).
 */
export function groupPhotocards(cards: MyPhotocard[]): PhotocardGroup[] {
  const groups = new Map<string, PhotocardGroup>();

  for (const card of cards) {
    const key = `${card.designName}|${card.marketType ?? ''}|${card.marketStatus ?? ''}`;
    const found = groups.get(key);
    if (found) found.count += 1;
    else groups.set(key, { card, count: 1 });
  }

  return [...groups.values()];
}

/** 내 포카 카드에 표시할 판매 상태. 서버의 실제 판매 방식과 정산 상태를 그대로 옮깁니다. */
export function photocardMarketState(
  card: MyPhotocard,
): 'STORED' | 'LISTED' | 'AUCTION' | 'SETTLING' {
  if (card.marketStatus === 'SETTLING') return 'SETTLING';
  if (card.marketType === 'AUCTION') return 'AUCTION';
  if (card.marketType === 'FIXED_PRICE' || card.listed) return 'LISTED';
  return 'STORED';
}

/** 발행이 끝나지 않은 카드에만 한 줄. MINTED 면 null (아무것도 안 보임) */
export function mintStatusLabel(status: PhotocardMintStatus): string | null {
  if (status === 'MINTED') return null;
  if (status === 'FAILED') return '발행 실패';
  return '발행 처리 중';
}
