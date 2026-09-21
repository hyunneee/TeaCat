import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Gavel } from 'lucide-react';
import { DetailHeader as Header } from '@/shared/components/layout';
import { Badge, Select } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useInfiniteScroll } from '@/shared/hooks';
import {
  AUCTION_STATUS_LABEL,
  AuctionCountdown,
  MY_AUCTION_FILTERS,
  isRunning,
  useMyAuctions,
  type AuctionStatus,
  type MyAuctionFilter,
} from '@/features/auction';
import { PocaArt, pocaSeed } from '@/features/nft';

/**
 * 내가 올린 경매.
 *
 * 한 줄에 담는 것: 카드 · 도안명 · 현재가(또는 체결가) · 상태.
 * 진행 중이면 상태 뱃지 대신 **남은 시간**을 보여줍니다 — 진행 중이라는 사실보다
 * 언제 끝나는지가 알고 싶은 값입니다.
 *
 * 취소 버튼은 여기 두지 않습니다. 되돌릴 수 없는 동작이라 목록에서 잘못 누르기 쉽고,
 * 경매 상세에 이미 확인 모달과 함께 있습니다. 눌러서 들어가면 됩니다.
 */
export function MyAuctionsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<MyAuctionFilter>('');

  const {
    data: rows,
    isPending,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMyAuctions(filter === '' ? undefined : (filter as AuctionStatus));

  const sentinel = useInfiniteScroll({
    hasNext: !!hasNextPage,
    isFetching: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  return (
    <>
      <Header title="내 경매" showBack />

      <div className="bg-canvas under-header sticky z-10 flex justify-end px-4 pt-2 pb-3 lg:top-[var(--top-inset)]">
        <Select
          label="상태"
          options={MY_AUCTION_FILTERS}
          value={filter}
          onChange={setFilter}
          className="shrink-0"
        />
      </div>

      <div className="px-4 pb-4">
        {isPending ? (
          <Loading label="경매를 불러오는 중" />
        ) : !rows || rows.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title={filter === '' ? '올린 경매가 없어요' : '해당하는 경매가 없어요'}
            description="내 포토카드 상세에서 경매로 올릴 수 있어요."
          />
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
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
                      {/* 상태 뱃지는 제목 **위**, 첫 줄에 (DESIGN.md 4장) */}
                      <div className="flex items-center gap-1.5 lg:col-start-2 lg:row-start-1 lg:justify-end">
                        {running ? (
                          <AuctionCountdown
                            endsAt={row.endsAt}
                            className="text-subtle text-xs font-semibold"
                          />
                        ) : (
                          <Badge tone={row.status === 'SOLD' ? 'success' : 'neutral'}>
                            {AUCTION_STATUS_LABEL[row.status]}
                          </Badge>
                        )}
                        <span className="text-subtle inline-flex items-center gap-0.5 text-xs">
                          <Gavel size={12} />
                          {row.bidCount}
                        </span>
                      </div>

                      <p className="mt-0.5 truncate font-bold lg:col-start-1 lg:row-start-1 lg:text-lg">
                        {row.designName}
                      </p>

                      <p className="mt-0.5 text-sm lg:col-start-2 lg:row-start-2 lg:text-right">
                        <span className="text-muted">
                          {row.status === 'SOLD' ? '체결가 ' : '현재가 '}
                        </span>
                        <span className="font-bold tabular-nums">
                          {row.currentPrice.toLocaleString()}
                        </span>
                        <span className="text-muted"> 캣머니</span>
                      </p>

                      {row.status === 'SOLD' && row.winnerNickname && (
                        <p className="text-subtle mt-0.5 truncate text-xs">
                          낙찰 {row.winnerNickname}
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
      </div>
    </>
  );
}
