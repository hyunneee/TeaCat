import { BadgeDollarSign } from 'lucide-react';
import { DetailHeader as Header } from '@/shared/components/layout';
import { EmptyState, Loading } from '@/shared/components/common';
import { useInfiniteScroll } from '@/shared/hooks';
import { formatDate } from '@/shared/lib';
import { PocaArt, pocaSeed, useMySales } from '@/features/nft';

/** 체결이 완료된 포카 판매 건만 보여주는 내 판매 내역입니다. */
export function NftSalesPage() {
  const sales = useMySales();
  const items = sales.data ?? [];
  const sentinel = useInfiniteScroll({
    hasNext: !!sales.hasNextPage,
    isFetching: sales.isFetchingNextPage,
    onLoadMore: sales.fetchNextPage,
  });

  return (
    <>
      <Header title="내 판매 내역" showBack />

      {sales.isPending ? (
        <Loading label="판매 내역을 불러오는 중" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={BadgeDollarSign}
          title="판매 내역이 없어요"
          description="포카 판매가 체결되면 여기에 쌓입니다."
        />
      ) : (
        <ul className="space-y-2 p-4">
          {items.map((sale) => (
            <li
              key={sale.tradeId}
              className="surface shadow-list flex items-center gap-3 rounded-2xl p-3 lg:gap-5 lg:p-5"
            >
              <div className="w-12 shrink-0 lg:w-16">
                <PocaArt
                  seed={pocaSeed(sale.photocardId)}
                  imageUrl={sale.imageUrl}
                  alt={`${sale.designName} 포토카드`}
                />
              </div>
              <div className="min-w-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-8 lg:gap-y-2">
                <p className="text-subtle text-xs lg:col-start-2 lg:row-start-1 lg:text-right">
                  {formatDate(sale.tradedAt)}
                </p>
                <p className="mt-0.5 truncate font-bold lg:col-start-1 lg:row-start-1 lg:text-lg">
                  {sale.designName}
                </p>
                <p className="text-subtle truncate text-xs">구매자 {sale.buyerNickname}</p>
                <p className="mt-1 text-sm font-bold tabular-nums lg:col-start-2 lg:row-start-2 lg:text-right">
                  +{sale.price.toLocaleString()} 캣머니
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div ref={sentinel} aria-hidden className="h-px" />
      {sales.isFetchingNextPage && <Loading label="더 불러오는 중" />}
    </>
  );
}
