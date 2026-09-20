import type { BidModalProps } from './BidModal';
import { ChevronRight, Gavel, TriangleAlert, Zap } from 'lucide-react';
import { BottomBar } from '@/shared/components/layout';
import { Badge, Button, SectionTitle } from '@/shared/components/ui';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { newIdempotencyKey } from '@/shared/api';
import { ROUTES } from '@/shared/constants';
import { AuctionCountdown } from './AuctionCountdown';
import { BidHistory } from './BidHistory';
import {
  auctionResultText,
  bidRange,
  canBid,
  canBuyNow,
  canCancel,
  isRunning,
} from '../model/auction.model';
import type { useAuctionTrade } from '../hooks/useAuctionTrade';

export function AuctionTradePanel({
  trade,
  showHeading = true,
  showCardLink = true,
  reserveBottomSpace = true,
  onBid,
  onConfirm,
}: {
  trade: ReturnType<typeof useAuctionTrade>;
  showHeading?: boolean;
  showCardLink?: boolean;
  reserveBottomSpace?: boolean;
  onBid: (props: BidModalProps) => void;
  onConfirm: (props: {
    title: string;
    message: string;
    confirmText: string;
    danger?: boolean;
    onConfirm: () => void;
  }) => void;
}) {
  const {
    auction,
    isPending,
    isError,
    refetch,
    bids,
    token,
    placeBid,
    bidding,
    buyNow,
    cancel,
    handleEnd,
    navigate,
    location,
  } = trade;
  if (isPending) return <PageLoader />;
  if (isError || !auction)
    return (
      <div role="alert">
        <EmptyState icon={TriangleAlert} title="경매를 불러오지 못했어요" />
        <Button variant="secondary" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </div>
    );
  const running = isRunning(auction);
  const result = auctionResultText(auction);
  const viewer = auction.viewer ?? null;
  const card = auction.photocard;
  const available = token?.available ?? 0;
  const range = bidRange(auction);

  return (
    <div className="space-y-4">
      {showHeading && (
        <div className="space-y-1">
          <p className="text-subtle text-[0.9375rem]">{card.performanceTitle}</p>
          <h1 className="text-xl leading-snug font-extrabold">{card.designName}</h1>
          <p className="text-muted text-sm">판매자 {auction.sellerNickname}</p>
        </div>
      )}

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
          <p className="mt-1 flex flex-wrap items-baseline gap-1">
            <span className="text-3xl font-extrabold break-all tabular-nums">
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
          <span className="font-semibold tabular-nums">{auction.startPrice.toLocaleString()}</span>
        </div>

        {auction.buyNowPrice != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted flex items-center gap-1">
              <Zap size={14} />
              즉시구매가
            </span>
            <span className="font-semibold tabular-nums">
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
        <p className="surface-2 rounded-2xl p-4 text-sm font-semibold">현재 최고 입찰자입니다.</p>
      )}
      {running &&
        viewer &&
        !viewer.isSeller &&
        !viewer.isTopBidder &&
        viewer.myHighestBid != null && (
          <p className="surface-2 text-muted rounded-2xl p-4 text-sm">
            내 최고 입찰 {viewer.myHighestBid.toLocaleString()}캣머니 · 더 높은 입찰에 밀렸습니다.
          </p>
        )}

      {/* 이 카드가 어떤 포카인지 궁금하면 상세로. 출처와 발행 정보는 거기 있습니다 */}
      {showCardLink && (
        <button
          type="button"
          onClick={() => navigate(ROUTES.NFT_DETAIL(String(card.photocardId)))}
          className="surface-2 hover:bg-surface-3 flex w-full items-center gap-2 rounded-2xl p-4 text-left text-sm font-semibold transition-colors"
        >
          <span className="min-w-0 flex-1 truncate">포토카드 정보 보기</span>
          <ChevronRight size={17} className="text-subtle shrink-0" />
        </button>
      )}

      {running && (
        <BottomBar inlineOnDesktop>
          {viewer && !viewer.isSeller && (
            <p className="text-subtle mb-2 text-sm">
              사용 가능 {available.toLocaleString()}캣머니
              {available < range.min ? ' · 입찰할 캣머니가 부족해요.' : ''}
            </p>
          )}
          {!viewer ? (
            <Button
              size="lg"
              fullWidth
              onClick={() =>
                navigate(ROUTES.LOGIN, { state: { from: location.pathname }, replace: false })
              }
            >
              로그인하고 입찰하기
            </Button>
          ) : viewer.isSeller ? (
            canCancel(auction) ? (
              /* 되돌릴 수 없는 동작이라 붉게, 그리고 한 번 되묻습니다 (DESIGN.md 1장) */
              <Button
                variant="danger-ghost"
                size="lg"
                fullWidth
                loading={cancel.isPending}
                onClick={() =>
                  onConfirm({
                    title: '경매를 취소할까요?',
                    message: '목록에서 사라지고, 다시 올리려면 조건을 새로 정해야 합니다.',
                    confirmText: '경매 취소',
                    danger: true,
                    onConfirm: () => cancel.mutate(),
                  })
                }
              >
                경매 취소하기
              </Button>
            ) : (
              <p className="text-subtle text-center text-sm">입찰이 있어 취소할 수 없습니다.</p>
            )
          ) : (
            <div className="flex gap-2">
              <Button
                size="lg"
                fullWidth
                disabled={!canBid(auction) || bidding || buyNow.isPending || available < range.min}
                loading={bidding}
                leftIcon={<Gavel size={18} />}
                onClick={() =>
                  onBid({
                    min: range.min,
                    max: range.max,
                    available,
                    onSubmit: placeBid,
                  })
                }
              >
                {viewer.isTopBidder ? '최고 입찰자예요' : '입찰하기'}
              </Button>

              {canBuyNow(auction) && auction.buyNowPrice != null && (
                <Button
                  variant="secondary"
                  size="lg"
                  className="shrink-0"
                  loading={buyNow.isPending}
                  disabled={buyNow.isPending || bidding || available < auction.buyNowPrice}
                  leftIcon={<Zap size={17} />}
                  onClick={() => {
                    /* 멱등키는 **모달을 열 때** 한 번 만듭니다. 확인을 두 번 누르거나
                       네트워크가 끊겨 재시도돼도 같은 키가 가서 한 번만 체결됩니다. */
                    const idempotencyKey = newIdempotencyKey();
                    onConfirm({
                      title: '즉시구매할까요?',
                      message: `${auction.buyNowPrice?.toLocaleString()}캣머니로 바로 가져오고 경매는 종료됩니다.`,
                      confirmText: '즉시구매',
                      onConfirm: () => buyNow.mutate(idempotencyKey),
                    });
                  }}
                >
                  즉시구매
                </Button>
              )}
            </div>
          )}
        </BottomBar>
      )}
      <section>
        <SectionTitle>입찰 이력</SectionTitle>
        {bids.isError ? (
          <div role="alert">
            <p>입찰 이력을 불러오지 못했어요.</p>
            <Button variant="secondary" onClick={() => void bids.refetch()}>
              다시 시도
            </Button>
          </div>
        ) : (
          <BidHistory
            bids={bids.data ?? []}
            topBidderNickname={auction.topBidderNickname}
            hasMore={!!bids.hasNextPage}
            loadingMore={bids.isFetchingNextPage}
            onLoadMore={() => void bids.fetchNextPage()}
          />
        )}
      </section>

      {reserveBottomSpace && running && <BottomBar.Spacer className="lg:hidden" />}
    </div>
  );
}
