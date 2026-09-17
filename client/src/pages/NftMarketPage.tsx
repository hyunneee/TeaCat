import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Coins, Gavel, Search, Sparkles } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Input, Segmented, Select } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useInfiniteScroll } from '@/shared/hooks';
import { useAuth } from '@/features/auth';
import { DEFAULT_SORT, NFT_SORTS, NftCard, useNftMarket, type NftSort } from '@/features/nft';
import {
  AUCTION_SORTS,
  AuctionCard,
  DEFAULT_AUCTION_SORT,
  useAuctions,
  type AuctionSort,
} from '@/features/auction';
import { useTokenBalance } from '@/features/token';

/** 거래 방식 — 정해진 가격의 상점 또는 실시간 입찰 경매 */
type MarketMode = 'SHOP' | 'AUCTION';

const MARKET_MODES = [
  { value: 'SHOP', label: '상점' },
  { value: 'AUCTION', label: '경매' },
] as const satisfies readonly { value: MarketMode; label: string }[];

/**
 * 포토카드 마켓.
 *
 * ── 화면 순서 ─────────────────────────────────────────────
 *   상점/경매 → 검색 → 잔액 / 정렬 → 2열 그리드
 *
 * 검색어는 상점·경매가 **공유**합니다. 상점에서 찾던 카드를 경매에서
 * 다시 찾을 때 같은 말을 두 번 치게 하지 않습니다.
 *
 * 등급(NORMAL/RARE/SPECIAL)은 없습니다. 카드의 가치는 등급표가 아니라
 * **어떤 공연의 어떤 순간인지**와 가격으로 정해집니다.
 */
export function NftMarketPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<MarketMode>(() =>
    searchParams.get('mode') === 'auction' ? 'AUCTION' : 'SHOP',
  );
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<NftSort>(DEFAULT_SORT);
  const [auctionSort, setAuctionSort] = useState<AuctionSort>(DEFAULT_AUCTION_SORT);
  const { isLoggedIn } = useAuth();

  const trimmed = keyword.trim();
  const shopping = mode === 'SHOP';
  const bidding = mode === 'AUCTION';

  const market = useNftMarket({ keyword: shopping ? trimmed : undefined, sort });
  const auction = useAuctions({ keyword: bidding ? trimmed : undefined, sort: auctionSort });
  const { data: token } = useTokenBalance();

  const active = shopping ? market : auction;
  const itemCount = shopping ? (market.data?.length ?? 0) : (auction.data?.length ?? 0);

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
      <div className="bg-canvas under-header sticky z-10 px-4 pt-2 pb-3 lg:px-0 lg:pt-3">
        {/* 공연·내 티켓과 같은 배치입니다. 폰에서는 검색이 먼저, 넓은 화면에서는
            상점/경매가 왼쪽·검색이 오른쪽에 한 줄로 놓입니다. */}
        <div className="lg:flex lg:items-center lg:gap-3">
          <div className="lg:order-2 lg:ml-auto lg:w-full lg:max-w-xs">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onClear={() => setKeyword('')}
              placeholder="도안명, 공연명으로 검색"
              leftIcon={<Search size={17} />}
              type="search"
              tone="contrast"
            />
          </div>

          <Segmented
            options={MARKET_MODES}
            value={mode}
            onChange={setMode}
            className="mt-2 lg:order-1 lg:mt-0 lg:w-72 lg:shrink-0"
          />
        </div>

        {/* 잔액 / 정렬을 **한 줄**에 둡니다.
            줄이 늘어날수록 카드가 아래로 밀리고, 마켓에서 보고 싶은 건 카드입니다. */}
        <div className="mt-3 flex items-center justify-end gap-2">
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

            {/* 정렬 기준이 상점과 경매가 다릅니다 — 경매에서 중요한 건 마감 시각입니다. */}
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
      <div className="px-4 pb-4 lg:px-0">
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
                  : '판매 중인 포토카드가 없어요'
            }
            description={
              trimmed
                ? '다른 키워드로 찾아보세요.'
                : bidding
                  ? '가진 포카를 경매로 올려 보세요.'
                  : '곧 새 카드가 올라옵니다.'
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-6 lg:grid-cols-4 lg:gap-x-4">
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
          </ul>
        )}

        {/* 목록 끝 센티널 — 보이면 다음 페이지 */}
        <div ref={sentinel} aria-hidden className="h-px" />
        {active.isFetchingNextPage && <Loading label="더 불러오는 중" className="py-4" />}
      </div>
    </>
  );
}
