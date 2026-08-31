import { mock, mockError } from '../router';
import { findConcert, findUser, iso, now, nftTrades, nfts, type MockNft } from '../db';
import { requireUser } from './auth';

function detail(nft: MockNft) {
  const concert = findConcert(nft.concertId);
  const owner = findUser(nft.ownerId);

  return {
    id: nft.id,
    name: nft.name,
    artSeed: nft.artSeed,
    seatLabel: nft.seatLabel,
    listPrice: nft.listPrice,
    description: nft.description,
    mintedAt: nft.mintedAt,
    concertId: nft.concertId,
    concertTitle: concert?.title ?? '',
    artist: concert?.artist ?? '',
    ownerId: nft.ownerId,
    ownerName: owner?.name ?? '',
  };
}

/* ── 마켓 전체 목록 (판매 등록된 것만) ── */
mock('GET', '/nfts', (ctx) => {
  const concertId = ctx.query.concertId;
  const keyword = (ctx.query.q ?? '').trim().toLowerCase();
  const sort = ctx.query.sort ?? 'RECENT';

  const items = nfts
    .filter((n) => n.listPrice !== null)
    .filter((n) => !concertId || n.concertId === concertId)
    .map(detail)
    // 포카 이름·공연명·아티스트 어느 쪽으로 찾아도 걸리게
    .filter(
      (n) =>
        !keyword ||
        [n.name, n.concertTitle, n.artist].some((field) =>
          field.toLowerCase().includes(keyword),
        ),
    );

  /* 정렬도 서버 몫입니다. 프론트가 받아온 목록만 정렬하면
     페이지네이션이 붙는 순간 그 페이지 안에서만 정렬됩니다. */
  items.sort((a, b) => {
    if (sort === 'PRICE_ASC') return (a.listPrice ?? 0) - (b.listPrice ?? 0);
    if (sort === 'PRICE_DESC') return (b.listPrice ?? 0) - (a.listPrice ?? 0);
    return new Date(b.mintedAt).getTime() - new Date(a.mintedAt).getTime();
  });

  return { items, nextCursor: null, hasNext: false };
});

mock('GET', '/nfts/:nftId', (ctx) => {
  const nft = nfts.find((n) => n.id === ctx.params.nftId);
  if (!nft) throw mockError(404, 'NOT_FOUND', '포토카드를 찾을 수 없습니다.');
  return detail(nft);
});

/* ── 내 포카 ── */
mock('GET', '/me/nfts', (ctx) => {
  const user = requireUser(ctx.headers);
  return nfts.filter((n) => n.ownerId === user.id).map(detail);
});

/* ── 구매 ── */
mock('POST', '/nfts/:nftId/purchase', (ctx) => {
  const user = requireUser(ctx.headers);
  const nft = nfts.find((n) => n.id === ctx.params.nftId);

  if (!nft) throw mockError(404, 'NOT_FOUND', '포토카드를 찾을 수 없습니다.');
  if (nft.listPrice === null) throw mockError(400, 'NOT_FOR_SALE', '판매 중인 포토카드가 아닙니다.');
  if (nft.ownerId === user.id) throw mockError(400, 'BAD_REQUEST', '내 포토카드입니다.');
  if (user.tokenBalance < nft.listPrice) {
    throw mockError(400, 'INSUFFICIENT_TOKEN', '포도알이 부족합니다.');
  }

  const seller = findUser(nft.ownerId);
  const price = nft.listPrice;
  user.tokenBalance -= price;
  if (seller) seller.tokenBalance += price;

  // 거래 기록을 남깁니다 — 양쪽의 "포카 거래 내역" 에 이 한 건이 나타납니다.
  nftTrades.push({
    id: `tr-${Date.now()}`,
    nftId: nft.id,
    buyerId: user.id,
    sellerId: nft.ownerId,
    price,
    tradedAt: iso(now()),
  });

  nft.ownerId = user.id;
  nft.listPrice = null;
  nft.description = null;

  return detail(nft);
});

/* ── 판매 등록 / 취소 ── */
mock('POST', '/nfts/:nftId/listing', (ctx) => {
  const user = requireUser(ctx.headers);
  const nft = nfts.find((n) => n.id === ctx.params.nftId);
  const { price, description } = ctx.body as { price?: number; description?: string };

  if (!nft) throw mockError(404, 'NOT_FOUND', '포토카드를 찾을 수 없습니다.');
  if (nft.ownerId !== user.id) throw mockError(403, 'FORBIDDEN', '본인 소유가 아닙니다.');
  if (!price || price <= 0) throw mockError(400, 'BAD_REQUEST', '판매 가격을 입력해 주세요.');
  // 길이 제한은 서버도 확인합니다. 프론트의 maxLength 는 우회할 수 있습니다.
  if ((description ?? '').length > 200) {
    throw mockError(400, 'BAD_REQUEST', '설명은 200자까지 입력할 수 있습니다.');
  }

  nft.listPrice = price;
  nft.description = description?.trim() || null;
  return detail(nft);
});

mock('DELETE', '/nfts/:nftId/listing', (ctx) => {
  const user = requireUser(ctx.headers);
  const nft = nfts.find((n) => n.id === ctx.params.nftId);

  if (!nft) throw mockError(404, 'NOT_FOUND', '포토카드를 찾을 수 없습니다.');
  if (nft.ownerId !== user.id) throw mockError(403, 'FORBIDDEN', '본인 소유가 아닙니다.');

  nft.listPrice = null;
  // 설명은 그 판매 건에 딸린 값이라 함께 지웁니다.
  nft.description = null;
  return detail(nft);
});

/* ── 내 거래 내역 ──
   산 것과 판 것을 한 목록에 최신순으로 섞어 보여줍니다.
   "내가 이 카드를 얼마에 샀더라" 를 확인하는 화면이라 둘을 나누면 오히려 불편합니다. */
mock('GET', '/me/nft-trades', (ctx) => {
  const user = requireUser(ctx.headers);

  return nftTrades
    .filter((trade) => trade.buyerId === user.id || trade.sellerId === user.id)
    .sort((a, b) => new Date(b.tradedAt).getTime() - new Date(a.tradedAt).getTime())
    .map((trade) => {
      const nft = nfts.find((n) => n.id === trade.nftId);
      const concert = nft ? findConcert(nft.concertId) : undefined;
      const isBuyer = trade.buyerId === user.id;
      const other = findUser(isBuyer ? trade.sellerId : trade.buyerId);

      return {
        id: trade.id,
        nftId: trade.nftId,
        nftName: nft?.name ?? '알 수 없는 카드',
        concertTitle: concert?.title ?? '',
        artSeed: nft?.artSeed ?? '',
        type: isBuyer ? 'BUY' : 'SELL',
        price: trade.price,
        tradedAt: trade.tradedAt,
        counterpartyName: other?.name ?? '알 수 없음',
      };
    });
});

/* ── 토큰 잔액 ──
   토큰 채굴 컨텐츠는 아직 미정이라 잔액 조회만 열어둡니다. */
mock('GET', '/me/token', (ctx) => {
  const user = requireUser(ctx.headers);
  return { balance: user.tokenBalance, symbol: 'GRAPE' };
});
