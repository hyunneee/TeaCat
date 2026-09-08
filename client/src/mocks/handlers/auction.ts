import { mock, mockError } from '../router';
import { auctions, findUser, parseTime, photocards, type MockAuction } from '../db';

/**
 * 경매 목업 — **서버 `NftAuctionController` 계약 그대로**.
 *
 * 경로·필드·에러 코드가 서버와 같습니다. 서버에 경매가 생기면
 * 이 파일과 `mocks/index.ts` 의 import 한 줄을 지우는 것으로 연동이 끝납니다.
 *
 * 커서는 포카 목업과 같은 규칙입니다 — `String(offset)`. 프론트는 커서를
 * 해석하지 않고 되돌려 보내기만 하므로 서버 형식과 달라도 상관없습니다.
 */

interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

/** 커서 페이지. size 1~100 (NFT_012), cursor 는 0 이상 정수 (NFT_011) */
export function page<T>(all: T[], query: Record<string, string>): CursorPage<T> {
  const size = query.size === undefined ? 20 : Number(query.size);
  if (!Number.isInteger(size) || size < 1 || size > 100) {
    throw mockError(400, 'NFT_012', '페이지 크기는 1 이상 100 이하여야 합니다.');
  }
  const offset = !query.cursor ? 0 : Number(query.cursor);
  if (!Number.isInteger(offset) || offset < 0) {
    throw mockError(400, 'NFT_011', '페이지 커서가 올바르지 않습니다.');
  }

  const items = all.slice(offset, offset + size);
  const hasNext = offset + size < all.length;
  return { items, nextCursor: hasNext ? String(offset + size) : null, hasNext };
}

const nickname = (userId: string) => findUser(userId)?.nickname ?? '알 수 없음';

/** 경매 한 건을 목록 항목 모양으로. 상세와 필드가 다릅니다 (서버도 DTO 가 둘) */
export function toSummary(auction: MockAuction) {
  const card = photocards.find((p) => p.photocardId === auction.photocardId);

  return {
    auctionId: auction.auctionId,
    photocardId: auction.photocardId,
    designName: card?.designName ?? '알 수 없는 카드',
    imageUrl: card?.imageUrl ?? null,
    performanceTitle: card?.performanceTitle ?? '',
    sellerNickname: nickname(auction.sellerId),
    startPrice: auction.startPrice,
    currentPrice: auction.currentPrice,
    buyNowPrice: auction.buyNowPrice,
    bidCount: auction.bidCount,
    endsAt: auction.endsAt,
    status: auction.status,
    closedAt: auction.closedAt,
    winnerNickname: auction.winnerId ? nickname(auction.winnerId) : null,
  };
}

/* ── A1 진행 중 경매 목록 ──
   서버는 `status = 'ACTIVE' AND ends_at > now()` 로 거릅니다.
   마감 시각이 지났는데 스위퍼가 아직 안 닫은 경매를 목록에 보이면
   카운트다운이 음수가 되기 때문입니다. 목업도 같게 거릅니다. */
mock('GET', '/nft-market/auctions', (ctx) => {
  const keyword = String(ctx.query.keyword ?? '')
    .trim()
    .toLowerCase();
  const sort = ctx.query.sort ?? 'ENDING_SOON';

  const items = auctions
    .filter((a) => a.status === 'ACTIVE' && parseTime(a.endsAt) > Date.now())
    .map(toSummary)
    .filter(
      (a) =>
        !keyword ||
        [a.designName, a.performanceTitle].some((f) => f.toLowerCase().includes(keyword)),
    );

  /* 정렬도 서버 몫입니다. 받아온 페이지만 정렬하면 다음 페이지와 순서가 어긋납니다. */
  items.sort((a, b) => {
    if (sort === 'CURRENT_PRICE') return a.currentPrice - b.currentPrice;
    if (sort === 'RECENT') return b.auctionId - a.auctionId;
    return parseTime(a.endsAt) - parseTime(b.endsAt); // ENDING_SOON
  });

  return page(items, ctx.query);
});
