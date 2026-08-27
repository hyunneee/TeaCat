import { mock, mockError } from '../router';
import { findConcert, findUser, nfts, type MockNft } from '../db';
import { requireUser } from './auth';

function detail(nft: MockNft) {
  const concert = findConcert(nft.concertId);
  const owner = findUser(nft.ownerId);

  return {
    id: nft.id,
    name: nft.name,
    rarity: nft.rarity,
    artSeed: nft.artSeed,
    seatLabel: nft.seatLabel,
    listPrice: nft.listPrice,
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
  const rarity = ctx.query.rarity;
  const concertId = ctx.query.concertId;

  const items = nfts
    .filter((n) => n.listPrice !== null)
    .filter((n) => !rarity || n.rarity === rarity)
    .filter((n) => !concertId || n.concertId === concertId)
    .map(detail);

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
    throw mockError(400, 'INSUFFICIENT_TOKEN', '보유 토큰이 부족합니다.');
  }

  const seller = findUser(nft.ownerId);
  user.tokenBalance -= nft.listPrice;
  if (seller) seller.tokenBalance += nft.listPrice;

  nft.ownerId = user.id;
  nft.listPrice = null;

  return detail(nft);
});

/* ── 판매 등록 / 취소 ── */
mock('POST', '/nfts/:nftId/listing', (ctx) => {
  const user = requireUser(ctx.headers);
  const nft = nfts.find((n) => n.id === ctx.params.nftId);
  const { price } = ctx.body as { price?: number };

  if (!nft) throw mockError(404, 'NOT_FOUND', '포토카드를 찾을 수 없습니다.');
  if (nft.ownerId !== user.id) throw mockError(403, 'FORBIDDEN', '본인 소유가 아닙니다.');
  if (!price || price <= 0) throw mockError(400, 'BAD_REQUEST', '판매 가격을 입력해 주세요.');

  nft.listPrice = price;
  return detail(nft);
});

mock('DELETE', '/nfts/:nftId/listing', (ctx) => {
  const user = requireUser(ctx.headers);
  const nft = nfts.find((n) => n.id === ctx.params.nftId);

  if (!nft) throw mockError(404, 'NOT_FOUND', '포토카드를 찾을 수 없습니다.');
  if (nft.ownerId !== user.id) throw mockError(403, 'FORBIDDEN', '본인 소유가 아닙니다.');

  nft.listPrice = null;
  return detail(nft);
});

/* ── 토큰 잔액 ──
   토큰 채굴 컨텐츠는 아직 미정이라 잔액 조회만 열어둡니다. */
mock('GET', '/me/token', (ctx) => {
  const user = requireUser(ctx.headers);
  return { balance: user.tokenBalance, symbol: 'GRAPE' };
});
