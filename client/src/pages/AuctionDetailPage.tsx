import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Gavel, TriangleAlert, Zap } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Badge, SectionTitle } from '@/shared/components/ui';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import {
  AuctionCountdown,
  BidHistory,
  auctionResultText,
  isRunning,
  useAuctionBids,
  useAuctionDetail,
} from '@/features/auction';
import { PocaShowcase, pocaSeed } from '@/features/nft';

/**
 * 경매 상세.
 *
 * ── 화면 순서 ─────────────────────────────────────────────
 *   카드 → 도안명·공연·판매자 → 가격과 마감 → 내 상태 → 입찰 이력
 *
 * ── 왜 현재가가 가장 큰가 ─────────────────────────────────
 * 경매에서 결정을 좌우하는 값은 "지금 얼마인가" 하나입니다.
 * 시작가와 즉시구매가는 그 값을 이해하는 배경이라 작게 둡니다.
 *
 * ── 마감은 서버가 판정합니다 ──────────────────────────────
 * 카운트다운이 0 이 되어도 화면이 "끝났다" 고 결론 내지 않습니다.
 * 상세를 다시 물어보고, **그 조회가 서버에서 경매를 닫아** 확정 결과를 돌려줍니다.
 * 클라이언트 시계로 판정하면 시계가 어긋난 기기에서 결과가 달라집니다.
 *
 * 비로그인도 들어올 수 있습니다 — 구경을 막으면 경매가 열려 있는지조차 알 수 없습니다.
 */
export function AuctionDetailPage() {
  const { auctionId: raw = '' } = useParams();
  const auctionId = Number(raw);
  const navigate = useNavigate();

  const { data: auction, isPending, isError, refetch } = useAuctionDetail(auctionId);
  const bids = useAuctionBids(auctionId);

  /* 카운트다운이 0 에 닿으면 서버에 결과를 물어봅니다.
     `refetch` 는 참조가 안정적이라 카운트다운이 매초 다시 부르지 않습니다. */
  const handleEnd = useCallback(() => {
    void refetch();
  }, [refetch]);

  const invalidId = !Number.isInteger(auctionId) || auctionId <= 0;

  if (!invalidId && isPending) return <PageLoader />;
  if (invalidId || isError || !auction) {
    return (
      <>
        <Header title="경매" showBack />
        <EmptyState icon={TriangleAlert} title="경매를 불러오지 못했어요" />
      </>
    );
  }

  const running = isRunning(auction);
  const result = auctionResultText(auction);
  const viewer = auction.viewer ?? null;
  const card = auction.photocard;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title="경매" showBack />

      <div className="flex-1">
        {/* 카드 무대 — 포카 상세와 같은 회색 바닥입니다. 같은 물건이니 같게 보여야 합니다 */}
        <div className="surface-2 border-line border-b px-6 py-8">
          <PocaShowcase
            className="mx-auto w-48"
            seed={pocaSeed(card.photocardId)}
            imageUrl={card.imageUrl}
            alt={`${card.designName} 포토카드`}
          />
        </div>

        <div className="space-y-4 p-4">
          <div className="space-y-1">
            <p className="text-subtle text-[0.9375rem]">{card.performanceTitle}</p>
            <h1 className="text-xl leading-snug font-extrabold">{card.designName}</h1>
            <p className="text-muted text-sm">판매자 {auction.sellerNickname}</p>
          </div>

          {/* 가격과 마감 — 이 화면에서 가장 먼저 읽혀야 하는 덩어리 */}
          <div className="surface-2 space-y-3 rounded-2xl p-4">
            <div>
              <p className="text-subtle flex items-center gap-1.5 text-sm">
                현재가
                <span className="text-ink-muted inline-flex items-center gap-0.5">
                  <Gavel size={13} />
                  {auction.bidCount}
                </span>
              </p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tabular-nums">
                  {auction.currentPrice.toLocaleString()}
                </span>
                <span className="text-ink-muted text-base font-bold">캣머니</span>
              </p>
              {auction.topBidderNickname && (
                <p className="text-subtle mt-1 truncate text-sm">
                  최고 입찰 {auction.topBidderNickname}
                </p>
              )}
            </div>

            <div className="border-line flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted">시작가</span>
              <span className="tabular-nums font-semibold">
                {auction.startPrice.toLocaleString()}
              </span>
            </div>

            {auction.buyNowPrice != null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted flex items-center gap-1">
                  <Zap size={14} />
                  즉시구매가
                </span>
                <span className="tabular-nums font-semibold">
                  {auction.buyNowPrice.toLocaleString()}
                </span>
              </div>
            )}

            {/* 진행 중일 때만 카운트다운. 끝난 경매에 "마감" 을 띄워 두면
                결과가 이미 나왔는데도 아직 진행 중인 것처럼 읽힙니다. */}
            {running ? (
              <div className="border-line flex items-center justify-between border-t pt-3">
                <span className="text-muted text-sm">남은 시간</span>
                <AuctionCountdown
                  endsAt={auction.endsAt}
                  onEnd={handleEnd}
                  className="text-[0.9375rem] font-extrabold"
                />
              </div>
            ) : (
              result && (
                <div className="border-line border-t pt-3">
                  <Badge tone={auction.status === 'SOLD' ? 'success' : 'neutral'} size="md">
                    {result}
                  </Badge>
                </div>
              )
            )}
          </div>

          {/* 내 상태 — 로그인한 사람에게만, 그리고 알려줄 게 있을 때만 */}
          {running && viewer?.isSeller && (
            <p className="surface-2 text-muted rounded-2xl p-4 text-sm">
              {auction.bidCount === 0
                ? '내가 올린 경매입니다.'
                : '입찰이 있어 경매를 취소할 수 없습니다.'}
            </p>
          )}
          {running && viewer && !viewer.isSeller && viewer.isTopBidder && (
            <p className="surface-2 rounded-2xl p-4 text-sm font-semibold">
              현재 최고 입찰자입니다.
            </p>
          )}
          {running && viewer && !viewer.isSeller && !viewer.isTopBidder && viewer.myHighestBid != null && (
            <p className="surface-2 text-muted rounded-2xl p-4 text-sm">
              내 최고 입찰 {viewer.myHighestBid.toLocaleString()}캣머니 · 더 높은 입찰에 밀렸습니다.
            </p>
          )}

          {/* 이 카드가 어떤 포카인지 궁금하면 상세로. 출처와 발행 정보는 거기 있습니다 */}
          <button
            type="button"
            onClick={() => navigate(ROUTES.NFT_DETAIL(String(card.photocardId)))}
            className="surface-2 hover:bg-surface-3 flex w-full items-center gap-2 rounded-2xl p-4 text-left text-sm font-semibold transition-colors"
          >
            <span className="min-w-0 flex-1 truncate">포토카드 정보 보기</span>
            <ChevronRight size={17} className="text-subtle shrink-0" />
          </button>

          <section>
            <SectionTitle>입찰 이력</SectionTitle>
            <BidHistory
              bids={bids.data ?? []}
              topBidderNickname={auction.topBidderNickname}
              hasMore={!!bids.hasNextPage}
              loadingMore={bids.isFetchingNextPage}
              onLoadMore={() => void bids.fetchNextPage()}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
