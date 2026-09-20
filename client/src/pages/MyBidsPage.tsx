import { useNavigate } from 'react-router-dom';
import { ChevronRight, Gavel } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Badge, Button } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useInfiniteScroll } from '@/shared/hooks';
import {
  AuctionCountdown,
  MY_BID_RESULT,
  isRunning,
  useMyBids,
  BidDateFilters,
  useBidDateFilter,
  formatBidTime,
} from '@/features/auction';
import { PocaArt, pocaSeed } from '@/features/nft';

/**
 * 내가 입찰한 경매.
 *
 * 여러 번 넣었어도 **경매당 한 줄**입니다. 같은 카드가 세 번 나오면
 * 무엇을 보고 있는지 알 수 없습니다.
 *
 * 이 화면에 오는 이유는 하나입니다 — "내가 아직 이기고 있나?"
 * 그래서 결과 뱃지가 첫 줄이고, 밀린 줄만 주의를 끌게 둡니다.
 * 붉은색은 쓰지 않습니다. 밀린 것은 되돌릴 수 없는 사고가 아니라 다시 넣으면 되는 일입니다.
 */
export function MyBidsPage() {
  const navigate = useNavigate();
  const filter = useBidDateFilter();
  const {
    data: rows,
    isPending,
    isError,
    isFetchNextPageError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMyBids(filter.dates);

  const sentinel = useInfiniteScroll({
    hasNext: !!hasNextPage && !filter.error && !isError,
    isFetching: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  return (
    <>
      <Header title="내 입찰" showBack className="lg:hidden" />

      <div className="p-4 lg:px-2 lg:pt-6">
        <BidDateFilters {...filter} />
        {filter.error ? null : isError && !isFetchNextPageError ? (
          <div role="alert" className="space-y-3 py-6 text-center">
            <p>입찰 내역을 불러오지 못했어요.</p>
            <Button variant="secondary" onClick={() => void refetch()}>
              다시 시도
            </Button>
          </div>
        ) : isPending ? (
          <Loading label="입찰 내역을 불러오는 중" />
        ) : !rows || rows.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title={
              filter.dates.from ? '선택한 기간에 입찰한 경매가 없어요' : '입찰한 경매가 없어요'
            }
            description={
              filter.dates.from
                ? '기간을 변경해 다시 확인해 보세요.'
                : '마켓 경매 탭에서 마음에 드는 카드에 입찰해 보세요.'
            }
          />
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const result = MY_BID_RESULT[row.result];
              const running = isRunning(row);

              return (
                <li key={row.auctionId}>
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.AUCTION_DETAIL(String(row.auctionId)))}
                    className="surface shadow-list hover:bg-surface-2 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors lg:gap-5 lg:p-5"
                  >
                    <div className="w-12 shrink-0 lg:w-16">
                      <PocaArt
                        seed={pocaSeed(row.photocardId)}
                        imageUrl={row.imageUrl}
                        alt={`${row.designName} 포토카드`}
                      />
                    </div>

                    <div className="min-w-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-8 lg:gap-y-2">
                      <div className="flex items-center gap-1.5 lg:col-start-2 lg:row-start-1 lg:justify-end">
                        <Badge tone={result.tone}>{result.label}</Badge>
                        {running && (
                          <AuctionCountdown
                            endsAt={row.endsAt}
                            hideIcon
                            className="text-subtle text-xs font-semibold"
                          />
                        )}
                      </div>

                      <p className="mt-0.5 truncate font-bold lg:col-start-1 lg:row-start-1 lg:text-lg">
                        {row.designName}
                      </p>

                      {/* 내 입찰가와 현재가를 나란히 둡니다 — 얼마 차이로 밀렸는지가
                          다시 넣을지 말지를 정합니다. 같으면 내가 최고가입니다. */}
                      <p className="mt-0.5 text-sm lg:col-start-2 lg:row-start-2 lg:text-right">
                        <span className="text-muted">내 최고 입찰 </span>
                        <span className="font-bold tabular-nums">
                          {row.myHighestBid.toLocaleString()}
                        </span>
                        {!row.isTopBidder && (
                          <>
                            <span className="text-muted"> · 현재가 </span>
                            <span className="font-bold tabular-nums">
                              {row.currentPrice.toLocaleString()}
                            </span>
                          </>
                        )}
                      </p>
                      {row.lastBidAt && (
                        <p className="text-subtle mt-1 text-xs lg:col-start-1 lg:row-start-2 lg:text-sm">
                          {filter.dates.from ? '기간 내 마지막 입찰' : '마지막 입찰'} ·{' '}
                          {formatBidTime(row.lastBidAt)}
                        </p>
                      )}
                    </div>

                    <ChevronRight size={18} className="text-subtle shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div ref={sentinel} aria-hidden className="h-px" />
        {isFetchingNextPage && <Loading label="더 불러오는 중" className="py-4" />}
        {!filter.error && isFetchNextPageError && (
          <div role="alert" className="py-4 text-center">
            <p>추가 내역을 불러오지 못했어요.</p>
            <Button variant="secondary" onClick={() => void fetchNextPage()}>
              다시 시도
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
