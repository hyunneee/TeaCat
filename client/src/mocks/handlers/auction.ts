import { mock, mockError } from '../router';
import {
  auctionBids,
  auctions,
  catMoneyHolds,
  findUser,
  iso,
  nextTradeId,
  now,
  parseTime,
  photocardTrades,
  photocards,
  type MockAuction,
} from '../db';
import { optionalUser } from './auth';

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

function findAuction(raw: string): MockAuction {
  const id = Number(raw);
  const auction = auctions.find((a) => a.auctionId === id);
  if (!auction) throw mockError(404, 'NFT_020', '존재하지 않는 경매입니다.');
  return auction;
}

/* ── 마감 ──────────────────────────────────────────────────
   서버는 10초마다 스위퍼가 돌고, 상세 조회도 만료를 확인해 닫습니다.
   목업에는 타이머를 두지 않고 **조회할 때마다** 만료된 경매를 닫습니다.
   타이머를 두면 화면을 안 보는 동안에도 돌아, 새로고침했을 때 이미 결과가
   바뀌어 있어 "언제 끝났지" 를 알 수 없습니다. 폴링이 4초마다 들어오므로
   결과적으로 서버와 같은 시점에 닫힙니다. */

function closeAuction(auction: MockAuction) {
  auction.closedAt = iso(now());

  const top =
    auction.topBidId === null ? undefined : auctionBids.find((b) => b.bidId === auction.topBidId);

  // 입찰이 없으면 유찰입니다.
  if (!top) {
    auction.status = 'EXPIRED';
    return;
  }

  // 낙찰 — 묶어 둔 돈을 확정하고(capture) 카드 주인을 옮깁니다.
  const hold = catMoneyHolds.find(
    (h) => h.refType === 'AUCTION_BID' && h.refId === top.bidId && h.status === 'ACTIVE',
  );
  if (hold) hold.status = 'CAPTURED';

  const buyer = findUser(top.bidderId);
  const seller = findUser(auction.sellerId);
  if (buyer) buyer.tokenBalance -= top.amount;
  if (seller) seller.tokenBalance += top.amount;

  const card = photocards.find((p) => p.photocardId === auction.photocardId);
  if (card) {
    card.ownerId = top.bidderId;
    card.listing = null;
  }

  // 낙찰도 거래 이력에 남습니다 — 구매·판매 내역 API 가 그대로 보여줍니다.
  photocardTrades.push({
    tradeId: nextTradeId(),
    photocardId: auction.photocardId,
    buyerId: top.bidderId,
    sellerId: auction.sellerId,
    price: top.amount,
    tradedAt: iso(now()),
  });

  auction.status = 'SOLD';
  auction.winnerId = top.bidderId;
}

/** 만료된 ACTIVE 경매를 모두 닫습니다. 조회 핸들러가 먼저 부릅니다 */
export function closeExpiredAuctions() {
  const nowMs = Date.now();
  for (const auction of auctions) {
    if (auction.status !== 'ACTIVE') continue;
    if (parseTime(auction.endsAt) > nowMs) continue;
    closeAuction(auction);
  }
}

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
  closeExpiredAuctions();

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

/* ── A2 경매 상세 ──
   공개 조회지만 토큰이 있으면 `viewer` 가 붙습니다.
   ⚠️ 이 조회가 만료된 경매를 **닫습니다** — 마감 직후에도 확정된 결과를 돌려줍니다. */
mock('GET', '/auctions/:auctionId', (ctx) => {
  closeExpiredAuctions();

  const auction = findAuction(ctx.params.auctionId ?? '');
  const card = photocards.find((p) => p.photocardId === auction.photocardId);
  const user = optionalUser(ctx.headers);

  const top =
    auction.topBidId === null ? undefined : auctionBids.find((b) => b.bidId === auction.topBidId);

  const myBids = user ? auctionBids.filter((b) => b.auctionId === auction.auctionId && b.bidderId === user.id) : [];
  const myHighest = myBids.length === 0 ? null : Math.max(...myBids.map((b) => b.amount));

  return {
    auctionId: auction.auctionId,
    status: auction.status,
    photocard: {
      photocardId: auction.photocardId,
      designName: card?.designName ?? '알 수 없는 카드',
      imageUrl: card?.imageUrl ?? null,
      performanceTitle: card?.performanceTitle ?? '',
    },
    sellerNickname: nickname(auction.sellerId),
    startPrice: auction.startPrice,
    currentPrice: auction.currentPrice,
    buyNowPrice: auction.buyNowPrice,
    bidCount: auction.bidCount,
    topBidderNickname: top ? nickname(top.bidderId) : null,
    createdAt: auction.createdAt,
    endsAt: auction.endsAt,
    closedAt: auction.closedAt,
    // 종료된 뒤에만 의미가 있습니다.
    winnerNickname: auction.winnerId ? nickname(auction.winnerId) : null,
    finalPrice: auction.status === 'SOLD' ? auction.currentPrice : null,
    viewer: user
      ? {
          isSeller: auction.sellerId === user.id,
          isTopBidder: !!top && top.bidderId === user.id,
          myHighestBid: myHighest,
        }
      : null,
  };
});

/* ── A3 입찰 이력 (최신순) ── */
mock('GET', '/auctions/:auctionId/bids', (ctx) => {
  const auction = findAuction(ctx.params.auctionId ?? '');

  const rows = auctionBids
    .filter((b) => b.auctionId === auction.auctionId)
    .sort((a, b) => b.bidId - a.bidId)
    .map((b) => ({
      bidId: b.bidId,
      bidderNickname: nickname(b.bidderId),
      amount: b.amount,
      bidAt: b.bidAt,
    }));

  return page(rows, ctx.query);
});
