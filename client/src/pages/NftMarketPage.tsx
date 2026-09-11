import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Gavel, Images, Search, Sparkles } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Input, Segmented, Select } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useInfiniteScroll } from '@/shared/hooks';
import { cn } from '@/shared/lib';
import { useAuth } from '@/features/auth';
import {
  DEFAULT_SORT,
  NFT_SORTS,
  NftCard,
  photocardSource,
  useMyPhotocards,
  useNftMarket,
  type NftSort,
} from '@/features/nft';
import {
  AUCTION_SORTS,
  AuctionCard,
  DEFAULT_AUCTION_SORT,
  useAuctions,
  type AuctionSort,
} from '@/features/auction';
import { useTokenBalance } from '@/features/token';

/** 마켓에서 보는 방향 — 사는 쪽인가, 파는 쪽인가 */
type Side = 'BUY' | 'SELL';

const SIDES = [
  { value: 'BUY', label: '구매' },
  { value: 'SELL', label: '판매' },
] as const satisfies readonly { value: Side; label: string }[];

/** 사는 방법 — 정해진 값에 바로 사거나(상점), 값을 겨뤄 사거나(경매) */
type BuyMode = 'SHOP' | 'AUCTION';

const BUY_MODES = [
  { value: 'SHOP', label: '상점' },
  { value: 'AUCTION', label: '경매' },
] as const satisfies readonly { value: BuyMode; label: string }[];

/**
 * 포토카드 마켓.
 *
 * ── 화면 순서 ─────────────────────────────────────────────
 *   구매/판매 → 검색 → 상점·경매 / 잔액 / 정렬 → 2열 그리드
 *
 * ── 층이 둘인 이유 ────────────────────────────────────────
 * 알약(Segmented)은 **구매 · 판매** 두 칸 그대로입니다.
 * 상점과 경매는 둘 다 "남의 카드를 사는 방법" 이고 판매는 "내 카드 목록" 이라,
 * 셋을 한 줄에 놓으면 성격이 다른 것이 같은 층으로 읽힙니다.
 *
 * 두 번째 층은 **글자 탭**입니다. 알약 아래 알약을 쌓으면 둘이 서로 경쟁해서
 * 어느 쪽이 지금 화면을 정하는지 알 수 없습니다. 선택된 쪽만 진하게 둡니다.
 * 줄 수는 세 줄 그대로라 카드가 아래로 밀리지 않습니다.
 *
 * 검색어는 상점·경매가 **공유**합니다. 상점에서 찾던 카드를 경매에서
 * 다시 찾을 때 같은 말을 두 번 치게 하지 않습니다.
 *
 * 등급(NORMAL/RARE/SPECIAL)은 없습니다. 카드의 가치는 등급표가 아니라
 * **어떤 공연의 어떤 순간인지**와 가격으로 정해집니다.
 */
export function NftMarketPage() {
  const navigate = useNavigate();
  const [side, setSide] = useState<Side>('BUY');
  const [mode, setMode] = useState<BuyMode>('SHOP');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<NftSort>(DEFAULT_SORT);
  const [auctionSort, setAuctionSort] = useState<AuctionSort>(DEFAULT_AUCTION_SORT);
  const { isLoggedIn } = useAuth();

  const trimmed = keyword.trim();
  const buying = side === 'BUY';
  const shopping = buying && mode === 'SHOP';
  const bidding = buying && mode === 'AUCTION';

  const market = useNftMarket({ keyword: shopping ? trimmed : undefined, sort });
  const auction = useAuctions({ keyword: bidding ? trimmed : undefined, sort: auctionSort });
  const mine = useMyPhotocards();
  const { data: token } = useTokenBalance();

  /* 내 카드는 받아온 만큼 화면에서 거릅니다 — 개수가 적어 서버를 또 부를 일이 아닙니다. */
  const myFiltered = useMemo(() => {
    const list = mine.data ?? [];
    if (!trimmed) return list;
    const needle = trimmed.toLowerCase();
    return list.filter(
      (card) =>
        card.designName.toLowerCase().includes(needle) ||
        (card.performanceTitle ?? '').toLowerCase().includes(needle),
    );
  }, [mine.data, trimmed]);

  const active = shopping ? market : bidding ? auction : mine;
  const itemCount = shopping
    ? (market.data?.length ?? 0)
    : bidding
      ? (auction.data?.length ?? 0)
      : myFiltered.length;

  const sentinel = useInfiniteScroll({
    hasNext: !!active.hasNextPage,
    isFetching: active.isFetchingNextPage,
    onLoadMore: active.fetchNextPage,
  });

  const goPhotocard = (photocardId: number) => navigate(ROUTES.NFT_DETAIL(String(photocardId)));

  return (
    <>
      <Header title="포토카드 마켓" />

      {/* ── 고정 영역 ──
          방향·검색·정렬은 **스크롤을 따라옵니다.** 카드를 한참 내려간 뒤에
          바꾸려고 맨 위까지 되올라가야 하면 아무도 안 바꿉니다.
          면이 불투명해야 카드가 뒤로 지나가는 게 보이지 않습니다. */}
      <div className="bg-canvas under-header sticky z-10 space-y-3 px-4 pt-4 pb-3">
        <Segmented options={SIDES} value={side} onChange={setSide} />

        {/* 검색·공연 화면의 검색창과 **같은 props** 입니다 (SearchPage 주석 참고) */}
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onClear={() => setKeyword('')}
          placeholder={buying ? '도안명, 공연명으로 검색' : '내 포카 검색'}
          leftIcon={<Search size={17} />}
          type="search"
          tone="contrast"
        />

        {/* 상점·경매 / 잔액 / 정렬을 **한 줄**에 둡니다.
            줄이 늘어날수록 카드가 아래로 밀리고, 마켓에서 보고 싶은 건 카드입니다. */}
        <div className="flex items-center justify-between gap-2">
          {buying ? (
            <div className="flex shrink-0 items-center gap-3">
              {BUY_MODES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMode(item.value)}
                  className={cn(
                    'text-sm transition-colors',
                    /* 밑줄이나 테두리를 두지 않습니다 — 목록에 선을 긋지 않는 것과 같은 이유입니다.
                       위계는 굵기와 밝기로만 만듭니다. */
                    mode === item.value ? 'text-ink font-extrabold' : 'text-subtle font-medium',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-subtle flex shrink-0 items-center gap-1.5 text-sm font-medium">
              <Images size={15} />
              <span className="tabular-nums">{myFiltered.length}</span>장
            </span>
          )}

          <div className="flex min-w-0 items-center gap-2">
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => navigate(ROUTES.TOKEN)}
                className="hover:text-ink flex min-w-0 items-center gap-1 text-sm font-semibold transition-colors"
              >
                <Coins size={16} className="text-ink-muted shrink-0" />
                {/* 쓸 수 있는 금액입니다 (features/token 의 token.types.ts 주석) */}
                <span className="tabular-nums">{(token?.available ?? 0).toLocaleString()}</span>
              </button>
            )}

            {/* 정렬 기준이 상점과 경매가 다릅니다 — 경매에서 중요한 건 마감 시각입니다.
                판매 탭에는 정렬이 없습니다. 내 카드는 몇 장뿐이라 정렬할 게 없습니다. */}
            {shopping && (
              <Select
                label="정렬"
                options={NFT_SORTS}
                value={sort}
                onChange={setSort}
                className="shrink-0"
              />
            )}
            {bidding && (
              <Select
                label="정렬"
                options={AUCTION_SORTS}
                value={auctionSort}
                onChange={setAuctionSort}
                className="shrink-0"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── 스크롤 영역 — 카드만 흐릅니다 ── */}
      <div className="px-4 pb-4">
        {active.isPending ? (
          <Loading label={bidding ? '경매를 불러오는 중' : '포토카드를 불러오는 중'} />
        ) : itemCount === 0 ? (
          <EmptyState
            icon={trimmed ? Search : bidding ? Gavel : Sparkles}
            title={
              trimmed
                ? '검색 결과가 없어요'
                : bidding
                  ? '진행 중인 경매가 없어요'
                  : shopping
                    ? '판매 중인 포토카드가 없어요'
                    : '보유한 포토카드가 없어요'
            }
            description={
              trimmed
                ? '다른 키워드로 찾아보세요.'
                : bidding
                  ? '가진 포카를 경매로 올려 보세요.'
                  : shopping
                    ? '곧 새 카드가 올라옵니다.'
                    : '공연을 관람하면 좌석에서 포토카드가 발행돼요.'
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-6">
            {shopping &&
              (market.data ?? []).map((card) => (
                <li key={card.photocardId}>
                  <NftCard
                    photocardId={card.photocardId}
                    designName={card.designName}
                    imageUrl={card.imageUrl}
                    performanceTitle={card.performanceTitle}
                    price={card.price}
                    onClick={() => goPhotocard(card.photocardId)}
                  />
                </li>
              ))}

            {bidding &&
              (auction.data ?? []).map((item) => (
                <li key={item.auctionId}>
                  <AuctionCard
                    photocardId={item.photocardId}
                    designName={item.designName}
                    imageUrl={item.imageUrl}
                    performanceTitle={item.performanceTitle}
                    currentPrice={item.currentPrice}
                    bidCount={item.bidCount}
                    endsAt={item.endsAt}
                    buyNowPrice={item.buyNowPrice}
                    onClick={() => navigate(ROUTES.AUCTION_DETAIL(String(item.auctionId)))}
                  />
                </li>
              ))}

            {!buying &&
              myFiltered.map((card) => (
                <li key={card.photocardId}>
                  {/* 내 카드에는 가격 대신 판매 상태가 뜹니다 (서버가 내 목록엔 가격을 주지 않습니다) */}
                  <NftCard
                    photocardId={card.photocardId}
                    designName={card.designName}
                    imageUrl={card.imageUrl}
                    performanceTitle={photocardSource(card.performanceTitle)}
                    state={card.listed ? 'LISTED' : 'STORED'}
                    onClick={() => goPhotocard(card.photocardId)}
                  />
                </li>
              ))}
          </ul>
        )}

        {/* 목록 끝 센티널 — 보이면 다음 페이지 */}
        <div ref={sentinel} aria-hidden className="h-px" />
        {active.isFetchingNextPage && <Loading label="더 불러오는 중" className="py-4" />}
      </div>
    </>
  );
}
