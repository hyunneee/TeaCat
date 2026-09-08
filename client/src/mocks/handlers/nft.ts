import { mock, mockError } from '../router';
import {
  findUser,
  iso,
  nextListingId,
  nextTradeId,
  now,
  photocardTrades,
  photocards,
  purchaseKeys,
  type MockPhotocard,
} from '../db';
import { requireUser } from './auth';

/**
 * 포카 목업 — **서버 `NftController` 계약 그대로**.
 *
 * 경로·필드·에러 코드가 서버와 같습니다. 서버에 포카 데이터가 생기면
 * 이 파일과 `mocks/index.ts` 의 import 한 줄을 지우는 것으로 연동이 끝납니다.
 * 화면·훅·api 는 건드리지 않습니다.
 *
 * 다른 점 하나 — 커서. 서버는 인코딩된 커서를 쓰고 여기는 `String(offset)` 입니다.
 * 프론트는 커서를 해석하지 않고 되돌려 보내기만 하므로 상관없습니다.
 */

/* ── 공통 ─────────────────────────────────────────────────── */

interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

/** 커서 페이지. size 1~100 (NFT_012), cursor 는 0 이상 정수 (NFT_011).
    ctx.query 는 axios params 그대로라 숫자·불리언으로 올 수 있어 Number()/String() 으로 맞춥니다. */
function page<T>(all: T[], query: Record<string, string>): CursorPage<T> {
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

function findPhotocard(raw: string): MockPhotocard {
  const id = Number(raw);
  const card = photocards.find((p) => p.photocardId === id);
  if (!card) throw mockError(404, 'NFT_001', '존재하지 않는 포토카드입니다.');
  return card;
}

const nickname = (userId: string) => findUser(userId)?.nickname ?? '알 수 없음';

const byLatest = <T extends { tradedAt: string }>(a: T, b: T) =>
  b.tradedAt.localeCompare(a.tradedAt);

type ListedPhotocard = MockPhotocard & { listing: NonNullable<MockPhotocard['listing']> };
const isListed = (p: MockPhotocard): p is ListedPhotocard => p.listing !== null;

/* ── P1 마켓 목록 (판매 중인 것만) ── */
mock('GET', '/nft-market/photocards', (ctx) => {
  const keyword = String(ctx.query.keyword ?? '')
    .trim()
    .toLowerCase();
  const sort = ctx.query.sort ?? 'RECENT';

  const listed = photocards
    .filter(isListed)
    .filter(
      (p) =>
        !keyword ||
        [p.designName, p.performanceTitle].some((f) => f.toLowerCase().includes(keyword)),
    );

  /* 정렬도 서버 몫입니다. 프론트가 받아온 목록만 정렬하면 페이지 안에서만 정렬됩니다. */
  listed.sort((a, b) => {
    if (sort === 'PRICE_ASC') return a.listing.price - b.listing.price;
    if (sort === 'PRICE_DESC') return b.listing.price - a.listing.price;
    return b.listing.listedAt.localeCompare(a.listing.listedAt);
  });

  return page(
    listed.map((p) => ({
      photocardId: p.photocardId,
      listingId: p.listing.listingId,
      designName: p.designName,
      imageUrl: p.imageUrl,
      performanceTitle: p.performanceTitle,
      price: p.listing.price,
      sellerNickname: nickname(p.ownerId),
    })),
    ctx.query,
  );
});

/* ── P2 상세 ── */
mock('GET', '/photocards/:photocardId', (ctx) => {
  const p = findPhotocard(ctx.params.photocardId ?? '');

  return {
    photocardId: p.photocardId,
    designName: p.designName,
    imageUrl: p.imageUrl,
    performanceTitle: p.performanceTitle,
    ownerNickname: nickname(p.ownerId),
    issuedAt: p.issuedAt,
    origin: p.origin,
    status: p.status,
    listing: p.listing
      ? {
          listingId: p.listing.listingId,
          price: p.listing.price,
          sellerDescription: p.listing.description,
          listedAt: p.listing.listedAt,
        }
      : null,
    // 경매 목업은 다음 브랜치에서 채웁니다.
    auction: null,
  };
});

/* ── P9 포카별 거래 이력 (화면 없음, api 만) ── */
mock('GET', '/photocards/:photocardId/trades', (ctx) => {
  const p = findPhotocard(ctx.params.photocardId ?? '');
  const trades = photocardTrades
    .filter((t) => t.photocardId === p.photocardId)
    .sort(byLatest)
    .map((t) => ({
      tradeId: t.tradeId,
      price: t.price,
      sellerNickname: nickname(t.sellerId),
      buyerNickname: nickname(t.buyerId),
      tradedAt: t.tradedAt,
    }));
  return page(trades, ctx.query);
});

/* ── P3 판매 등록 ── */
mock('POST', '/photocards/:photocardId/listing', (ctx) => {
  const user = requireUser(ctx.headers);
  const p = findPhotocard(ctx.params.photocardId ?? '');
  const { price, description } = ctx.body as { price?: unknown; description?: unknown };

  // 서버 @Valid 와 같은 모양 — code 없이 400 + 메시지
  if (typeof price !== 'number' || !Number.isInteger(price) || price < 1) {
    throw mockError(400, '', '판매가를 1 이상으로 입력해 주세요.');
  }
  if (typeof description !== 'string' || description.trim().length === 0) {
    throw mockError(400, '', '판매자 설명을 입력해 주세요.');
  }
  if (description.length > 500) {
    throw mockError(400, '', '판매자 설명은 500자 이하로 입력해 주세요.');
  }

  if (p.ownerId !== user.id) throw mockError(403, 'NFT_003', '본인이 소유한 포토카드가 아닙니다.');
  if (p.listing) throw mockError(409, 'NFT_004', '이미 판매 등록된 포토카드입니다.');

  p.listing = {
    listingId: nextListingId(),
    price,
    description: description.trim(),
    listedAt: iso(now()),
  };

  return {
    listingId: p.listing.listingId,
    price: p.listing.price,
    description: p.listing.description,
    status: 'ACTIVE',
  };
});

/* ── P4 판매 취소 ── */
mock('DELETE', '/photocards/:photocardId/listing', (ctx) => {
  const user = requireUser(ctx.headers);
  const p = findPhotocard(ctx.params.photocardId ?? '');

  if (!p.listing) throw mockError(404, 'NFT_005', '활성 판매 등록 정보를 찾을 수 없습니다.');
  if (p.ownerId !== user.id) throw mockError(403, 'NFT_006', '본인의 판매 등록이 아닙니다.');

  p.listing = null;
  // 서버는 data 없이 message 만 줍니다.
  return null;
});

/* ── P5 구매 (Idempotency-Key 필수) ── */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

mock('POST', '/photocards/:photocardId/purchase', (ctx) => {
  const user = requireUser(ctx.headers);
  const p = findPhotocard(ctx.params.photocardId ?? '');

  const key = ctx.headers['idempotency-key'] ?? ctx.headers['Idempotency-Key'] ?? '';
  if (!UUID.test(key)) {
    throw mockError(400, 'NFT_009', 'Idempotency-Key는 UUID 형식이어야 합니다.');
  }

  const stored = purchaseKeys.get(`${user.id}:${key}`);
  if (stored) {
    if (stored.photocardId !== p.photocardId) {
      throw mockError(409, 'NFT_010', '다른 요청에서 이미 사용한 Idempotency-Key입니다.');
    }
    return stored.response; // 재시도 — 같은 응답
  }

  if (!p.listing) throw mockError(409, 'NFT_008', '이미 판매 완료되었거나 취소된 포토카드입니다.');
  if (p.ownerId === user.id) {
    throw mockError(400, 'NFT_007', '본인이 판매 중인 포토카드는 구매할 수 없습니다.');
  }

  const price = p.listing.price;
  /* 목업 잔액 차감. 화면 잔액은 실서버라 어긋나지만, 목업 안에서 "잔액 부족" 분기를 볼 수 있게 남깁니다.
     실서버는 캣머니 이체 연동 전이라 이 검사를 하지 않습니다. */
  if (user.tokenBalance < price) {
    throw mockError(409, 'WALLET_005', '캣머니 가용 잔액이 부족합니다.');
  }
  const seller = findUser(p.ownerId);
  user.tokenBalance -= price;
  if (seller) seller.tokenBalance += price;

  const trade = {
    tradeId: nextTradeId(),
    photocardId: p.photocardId,
    buyerId: user.id,
    sellerId: p.ownerId,
    price,
    tradedAt: iso(now()),
  };
  photocardTrades.push(trade);

  p.ownerId = user.id;
  p.listing = null;

  const response = {
    tradeId: trade.tradeId,
    photocardId: trade.photocardId,
    price: trade.price,
    tradedAt: trade.tradedAt,
  };
  purchaseKeys.set(`${user.id}:${key}`, { photocardId: p.photocardId, response });
  return response;
});

/* ── P6 내 포카 (최신 발행순, listed 필터) ── */
mock('GET', '/users/me/photocards', (ctx) => {
  const user = requireUser(ctx.headers);
  // ctx.query 는 axios params 그대로라 불리언으로 올 수 있다 → 문자열로 맞춰 비교
  const listedFilter =
    ctx.query.listed === undefined ? undefined : String(ctx.query.listed) === 'true';

  const mine = photocards
    .filter((p) => p.ownerId === user.id)
    .filter((p) => listedFilter === undefined || (p.listing !== null) === listedFilter)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
    .map((p) => ({
      photocardId: p.photocardId,
      designName: p.designName,
      imageUrl: p.imageUrl,
      performanceTitle: p.performanceTitle,
      status: p.status,
      listed: p.listing !== null,
    }));

  return page(mine, ctx.query);
});

/* ── P7 내 구매 내역 ── */
mock('GET', '/users/me/photocards/purchases', (ctx) => {
  const user = requireUser(ctx.headers);
  const rows = photocardTrades
    .filter((t) => t.buyerId === user.id)
    .sort(byLatest)
    .map((t) => {
      const p = photocards.find((c) => c.photocardId === t.photocardId);
      return {
        tradeId: t.tradeId,
        photocardId: t.photocardId,
        designName: p?.designName ?? '알 수 없는 카드',
        imageUrl: p?.imageUrl ?? null,
        sellerNickname: nickname(t.sellerId),
        price: t.price,
        tradedAt: t.tradedAt,
      };
    });
  return page(rows, ctx.query);
});

/* ── P8 내 판매 내역 ── */
mock('GET', '/users/me/photocards/sales', (ctx) => {
  const user = requireUser(ctx.headers);
  const rows = photocardTrades
    .filter((t) => t.sellerId === user.id)
    .sort(byLatest)
    .map((t) => {
      const p = photocards.find((c) => c.photocardId === t.photocardId);
      return {
        tradeId: t.tradeId,
        photocardId: t.photocardId,
        designName: p?.designName ?? '알 수 없는 카드',
        imageUrl: p?.imageUrl ?? null,
        buyerNickname: nickname(t.buyerId),
        price: t.price,
        tradedAt: t.tradedAt,
      };
    });
  return page(rows, ctx.query);
});
