import { mock, mockError } from '../router';
import {
  auctionBids,
  auctions,
  catMoneyHolds,
  findUser,
  iso,
  nextAuctionId,
  nextBidId,
  nextTradeId,
  now,
  parseTime,
  photocardTrades,
  photocards,
  purchaseKeys,
  type MockAuction,
} from '../db';
import { optionalUser, requireUser } from './auth';

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

/**
 * 이 포카에 걸려 있는 진행 중 경매. 없으면 undefined.
 * 포카 상세(`handlers/nft.ts`)와 등록 가드가 함께 씁니다 —
 * 포카 한 장은 고정가와 경매 중 하나에만 올라갑니다.
 */
export function findActiveAuction(photocardId: number): MockAuction | undefined {
  return auctions.find((a) => a.photocardId === photocardId && a.status === 'ACTIVE');
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

/* ── 쓰기 경로 공통 ────────────────────────────────────────
   서버는 마감 시각이 지난 경매를 **쓰기 경로에서 닫지 않습니다.**
   닫은 뒤 거절하면 그 롤백이 마감까지 되돌리기 때문입니다(server 설계 6-7).
   대신 DB 시각으로 거절만 하고(NFT_023), 프론트가 상세를 다시 읽어 그 GET 이 닫습니다.
   목업도 같은 순서를 지킵니다 — 쓰기 핸들러는 closeExpiredAuctions 를 부르지 않습니다. */

/** 지금 쓸 수 있는 캣머니 = 잔액 − 묶여 있는 금액 */
function availableBalance(userId: string): number {
  const user = findUser(userId);
  if (!user) return 0;
  const held = catMoneyHolds
    .filter((h) => h.userId === userId && h.status === 'ACTIVE')
    .reduce((sum, h) => sum + h.amount, 0);
  return user.tokenBalance - held;
}

/** 진행 중인 경매인지 확인하고, 아니면 서버와 같은 코드로 거절합니다 */
function assertRunning(auction: MockAuction) {
  if (auction.status !== 'ACTIVE') {
    throw mockError(409, 'NFT_022', '종료되었거나 취소된 경매입니다.');
  }
  if (parseTime(auction.endsAt) <= Date.now()) {
    throw mockError(409, 'NFT_023', '마감된 경매입니다.');
  }
}

/* ── B3 입찰 ── */
mock('POST', '/auctions/:auctionId/bids', (ctx) => {
  const user = requireUser(ctx.headers);
  const auction = findAuction(ctx.params.auctionId ?? '');
  const { amount } = ctx.body as { amount?: unknown };

  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1) {
    throw mockError(400, '', '입찰가를 1 이상으로 입력해 주세요.');
  }

  assertRunning(auction);

  /* 검사 순서가 서버와 같아야 합니다 — 같은 상황에서 같은 코드가 나와야
     화면의 분기가 목업과 실서버에서 똑같이 동작합니다. */
  if (auction.sellerId === user.id) {
    throw mockError(400, 'NFT_025', '본인이 올린 경매에는 입찰할 수 없습니다.');
  }

  const top =
    auction.topBidId === null ? undefined : auctionBids.find((b) => b.bidId === auction.topBidId);
  if (top && top.bidderId === user.id) {
    throw mockError(409, 'NFT_026', '이미 최고 입찰자입니다.');
  }
  if (amount <= auction.currentPrice) {
    throw mockError(409, 'NFT_027', '현재가보다 높은 금액으로 입찰해 주세요.');
  }
  if (auction.buyNowPrice !== null && amount >= auction.buyNowPrice) {
    throw mockError(400, 'NFT_028', '즉시구매가 이상은 입찰할 수 없습니다. 즉시구매를 이용해 주세요.');
  }
  if (availableBalance(user.id) < amount) {
    throw mockError(409, 'WALLET_005', '캣머니 가용 잔액이 부족합니다.');
  }

  const bid = {
    bidId: nextBidId(),
    auctionId: auction.auctionId,
    bidderId: user.id,
    amount,
    bidAt: iso(now()),
  };
  auctionBids.push(bid);

  // 내 돈을 묶고, 밀려난 직전 최고 입찰의 돈은 풀어 줍니다.
  catMoneyHolds.push({
    userId: user.id,
    amount,
    refType: 'AUCTION_BID',
    refId: bid.bidId,
    status: 'ACTIVE',
  });
  if (top) {
    const previous = catMoneyHolds.find(
      (h) => h.refType === 'AUCTION_BID' && h.refId === top.bidId && h.status === 'ACTIVE',
    );
    if (previous) previous.status = 'RELEASED';
  }

  auction.currentPrice = amount;
  auction.topBidId = bid.bidId;
  auction.bidCount += 1;

  return {
    bidId: bid.bidId,
    auctionId: auction.auctionId,
    amount,
    currentPrice: auction.currentPrice,
    bidCount: auction.bidCount,
    endsAt: auction.endsAt,
    isTopBidder: true,
  };
});

/* ── B4 즉시구매 (Idempotency-Key 필수) ── */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

mock('POST', '/auctions/:auctionId/buy-now', (ctx) => {
  const user = requireUser(ctx.headers);
  const auction = findAuction(ctx.params.auctionId ?? '');

  const key = ctx.headers['idempotency-key'] ?? ctx.headers['Idempotency-Key'] ?? '';
  if (!UUID.test(key)) {
    throw mockError(400, 'NFT_009', 'Idempotency-Key는 UUID 형식이어야 합니다.');
  }

  const stored = purchaseKeys.get(`${user.id}:${key}`);
  if (stored) {
    if (stored.photocardId !== auction.photocardId) {
      throw mockError(409, 'NFT_010', '다른 요청에서 이미 사용한 Idempotency-Key입니다.');
    }
    return stored.response; // 재시도 — 같은 응답
  }

  assertRunning(auction);

  if (auction.buyNowPrice === null) {
    throw mockError(409, 'NFT_029', '즉시구매가 없는 경매입니다.');
  }
  if (auction.sellerId === user.id) {
    throw mockError(400, 'NFT_007', '본인이 판매 중인 포토카드는 구매할 수 없습니다.');
  }

  const price = auction.buyNowPrice;
  if (availableBalance(user.id) < price) {
    throw mockError(409, 'WALLET_005', '캣머니 가용 잔액이 부족합니다.');
  }

  // 최고 입찰자가 있었다면 그 사람 돈을 풀어 줍니다 — 경매가 여기서 끝나기 때문입니다.
  const top =
    auction.topBidId === null ? undefined : auctionBids.find((b) => b.bidId === auction.topBidId);
  if (top) {
    const hold = catMoneyHolds.find(
      (h) => h.refType === 'AUCTION_BID' && h.refId === top.bidId && h.status === 'ACTIVE',
    );
    if (hold) hold.status = 'RELEASED';
  }

  const seller = findUser(auction.sellerId);
  user.tokenBalance -= price;
  if (seller) seller.tokenBalance += price;

  const card = photocards.find((p) => p.photocardId === auction.photocardId);
  if (card) {
    card.ownerId = user.id;
    card.listing = null;
  }

  const trade = {
    tradeId: nextTradeId(),
    photocardId: auction.photocardId,
    buyerId: user.id,
    sellerId: auction.sellerId,
    price,
    tradedAt: iso(now()),
  };
  photocardTrades.push(trade);

  auction.status = 'SOLD';
  auction.winnerId = user.id;
  auction.currentPrice = price;
  auction.closedAt = iso(now());

  const response = {
    tradeId: trade.tradeId,
    photocardId: trade.photocardId,
    price: trade.price,
    tradedAt: trade.tradedAt,
  };
  purchaseKeys.set(`${user.id}:${key}`, { photocardId: auction.photocardId, response });
  return response;
});

/* ── B2 판매자 취소 (입찰 0건일 때만) ── */
mock('DELETE', '/auctions/:auctionId', (ctx) => {
  const user = requireUser(ctx.headers);
  const auction = findAuction(ctx.params.auctionId ?? '');

  if (auction.sellerId !== user.id) {
    throw mockError(403, 'NFT_006', '본인의 판매 등록이 아닙니다.');
  }
  assertRunning(auction);
  if (auction.bidCount > 0) {
    throw mockError(409, 'NFT_024', '입찰이 있는 경매는 취소할 수 없습니다.');
  }

  auction.status = 'CANCELLED';
  auction.closedAt = iso(now());
  return null;
});

/* ── B1 경매 등록 ── */

/** 서버 설정(`nft.auction.min-duration` ~ `max-duration`)의 기본값과 같습니다 */
const MIN_DURATION_HOURS = 1;
const MAX_DURATION_HOURS = 168; // 7일

mock('POST', '/photocards/:photocardId/auction', (ctx) => {
  const user = requireUser(ctx.headers);

  const photocardId = Number(ctx.params.photocardId);
  const card = photocards.find((p) => p.photocardId === photocardId);
  if (!card) throw mockError(404, 'NFT_001', '존재하지 않는 포토카드입니다.');
  if (card.ownerId !== user.id) {
    throw mockError(403, 'NFT_003', '본인이 소유한 포토카드가 아닙니다.');
  }

  // 고정가와 경매는 동시에 올라갈 수 없습니다. 둘 다 확인합니다.
  if (card.listing) throw mockError(409, 'NFT_004', '이미 판매 등록된 포토카드입니다.');
  if (findActiveAuction(photocardId)) {
    throw mockError(409, 'NFT_021', '이미 경매가 진행 중인 포토카드입니다.');
  }

  const { startPrice, buyNowPrice, durationHours } = ctx.body as {
    startPrice?: unknown;
    buyNowPrice?: unknown;
    durationHours?: unknown;
  };

  // 서버 @Valid 와 같은 모양 — code 없이 400 + 메시지
  if (typeof startPrice !== 'number' || !Number.isInteger(startPrice) || startPrice < 1) {
    throw mockError(400, '', '시작가를 1 이상으로 입력해 주세요.');
  }
  if (typeof durationHours !== 'number' || !Number.isInteger(durationHours)) {
    throw mockError(400, '', '진행 시간을 입력해 주세요.');
  }
  if (durationHours < MIN_DURATION_HOURS || durationHours > MAX_DURATION_HOURS) {
    throw mockError(400, 'NFT_030', '경매 기간이 허용 범위를 벗어났습니다.');
  }

  const buyNow = buyNowPrice === undefined || buyNowPrice === null ? null : Number(buyNowPrice);
  if (buyNow !== null) {
    if (!Number.isInteger(buyNow) || buyNow < 1) {
      throw mockError(400, '', '즉시구매가를 1 이상으로 입력해 주세요.');
    }
    if (buyNow <= startPrice) {
      throw mockError(400, 'NFT_031', '즉시구매가는 시작가보다 높아야 합니다.');
    }
  }

  const auction: MockAuction = {
    auctionId: nextAuctionId(),
    photocardId,
    sellerId: user.id,
    startPrice,
    buyNowPrice: buyNow,
    // 아직 입찰이 없으므로 현재가는 시작가입니다.
    currentPrice: startPrice,
    topBidId: null,
    bidCount: 0,
    endsAt: iso(now() + durationHours * 3600_000),
    status: 'ACTIVE',
    winnerId: null,
    createdAt: iso(now()),
    closedAt: null,
  };
  auctions.push(auction);

  return {
    auctionId: auction.auctionId,
    photocardId: auction.photocardId,
    status: auction.status,
    startPrice: auction.startPrice,
    buyNowPrice: auction.buyNowPrice,
    currentPrice: auction.currentPrice,
    endsAt: auction.endsAt,
    createdAt: auction.createdAt,
  };
});

/* ── B5 내가 올린 경매 ── */
mock('GET', '/users/me/auctions', (ctx) => {
  closeExpiredAuctions();

  const user = requireUser(ctx.headers);
  const status = ctx.query.status ? String(ctx.query.status) : undefined;

  const rows = auctions
    .filter((a) => a.sellerId === user.id)
    .filter((a) => !status || a.status === status)
    // 최근에 올린 것부터. id 가 증가 순서라 그대로 시간 순서입니다.
    .sort((a, b) => b.auctionId - a.auctionId)
    .map(toSummary);

  return page(rows, ctx.query);
});

/* ── B6 내가 입찰한 경매 ──
   여러 번 입찰했어도 **경매 단위로 한 줄**입니다. 같은 카드가 목록에
   세 번 나오면 무엇을 보고 있는지 알 수 없습니다. */
mock('GET', '/users/me/bids', (ctx) => {
  closeExpiredAuctions();

  const user = requireUser(ctx.headers);
  const myBids = auctionBids.filter((b) => b.bidderId === user.id);

  // 경매별로 내 입찰을 모읍니다.
  const byAuction = new Map<number, { highest: number; lastBidId: number }>();
  for (const bid of myBids) {
    const prev = byAuction.get(bid.auctionId);
    byAuction.set(bid.auctionId, {
      highest: Math.max(prev?.highest ?? 0, bid.amount),
      lastBidId: Math.max(prev?.lastBidId ?? 0, bid.bidId),
    });
  }

  const rows = [...byAuction.entries()]
    // 내가 마지막으로 입찰한 순서대로 — 방금 넣은 경매가 맨 위입니다.
    .sort((a, b) => b[1].lastBidId - a[1].lastBidId)
    .flatMap(([auctionId, mine]) => {
      const auction = auctions.find((a) => a.auctionId === auctionId);
      if (!auction) return [];

      const card = photocards.find((p) => p.photocardId === auction.photocardId);
      const top =
        auction.topBidId === null
          ? undefined
          : auctionBids.find((b) => b.bidId === auction.topBidId);
      const isTopBidder = !!top && top.bidderId === user.id;

      /* 진행 중이면 지금 내가 이기고 있는지, 끝났으면 가져갔는지.
         입찰이 있는 경매는 취소가 불가능하므로 "취소됨" 은 나오지 않습니다. */
      const result =
        auction.status === 'ACTIVE'
          ? isTopBidder
            ? 'BIDDING'
            : 'OUTBID'
          : auction.winnerId === user.id
            ? 'WON'
            : 'LOST';

      return [
        {
          auctionId: auction.auctionId,
          photocardId: auction.photocardId,
          designName: card?.designName ?? '알 수 없는 카드',
          imageUrl: card?.imageUrl ?? null,
          myHighestBid: mine.highest,
          currentPrice: auction.currentPrice,
          isTopBidder,
          status: auction.status,
          endsAt: auction.endsAt,
          result,
        },
      ];
    });

  return page(rows, ctx.query);
});
