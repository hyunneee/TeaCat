import { useNavigate } from 'react-router-dom';
import { ChevronRight, Receipt } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useInfiniteScroll } from '@/shared/hooks';
import { formatDate } from '@/shared/lib';
import { PocaArt, pocaSeed, useMyTrades } from '@/features/nft';

/**
 * 포카 거래 내역.
 *
 * 산 것과 판 것을 **한 목록에 최신순으로** 섞어 보여줍니다.
 * "내가 이 카드를 얼마에 샀더라" 를 확인하러 오는 화면이라,
 * 구매·판매 탭으로 나누면 오히려 두 번 찾게 됩니다. 구분은 금액 부호로 합니다.
 * (서버는 구매·판매를 따로 주고, 훅이 합칩니다)
 *
 * 한 줄에 담는 것: 날짜 · 카드 · 카드 이름 · 거래 상대 · 오간 캣머니.
 * 그 이상은 카드 상세로 넘깁니다.
 */
export function NftTradesPage() {
  const navigate = useNavigate();
  const { trades, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useMyTrades();

  const sentinel = useInfiniteScroll({
    hasNext: hasNextPage,
    isFetching: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  return (
    <>
      <Header title="포카 거래 내역" showBack />

      {isPending ? (
        <Loading label="거래 내역을 불러오는 중" />
      ) : trades.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="거래 내역이 없어요"
          description="마켓에서 포카를 사고팔면 여기에 쌓입니다."
        />
      ) : (
        <ul className="space-y-2 p-4">
          {trades.map((trade) => {
            const bought = trade.type === 'BUY';

            return (
              <li key={`${trade.type}-${trade.tradeId}`}>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.NFT_DETAIL(String(trade.photocardId)))}
                  className="surface shadow-list hover:bg-surface-2 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors"
                >
                  <div className="w-12 shrink-0">
                    <PocaArt
                      seed={pocaSeed(trade.photocardId)}
                      imageUrl={trade.imageUrl}
                      alt={`${trade.designName} 포토카드`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-subtle text-xs">{formatDate(trade.tradedAt)}</p>
                    <p className="mt-0.5 truncate font-bold">{trade.designName}</p>
                    {/* 서버 이력에는 공연명이 없습니다. 그 자리에 거래 상대를 둡니다. */}
                    <p className="text-subtle truncate text-xs">
                      {bought ? '판매자' : '구매자'} {trade.counterpartyNickname}
                    </p>

                    <p className="mt-1 text-sm">
                      <span className="text-muted">{bought ? '구매' : '판매'} </span>
                      {/* 나간 돈과 들어온 돈은 **부호**로 구분합니다.
                          색을 쓰지 않아도 −/+ 로 방향이 읽힙니다. */}
                      <span className="text-ink font-bold tabular-nums">
                        {bought ? '−' : '+'}
                        {trade.price.toLocaleString()} 캣머니
                      </span>
                    </p>
                  </div>

                  <ChevronRight size={18} className="text-subtle shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div ref={sentinel} aria-hidden className="h-px" />
      {isFetchingNextPage && <Loading label="더 불러오는 중" />}
    </>
  );
}
