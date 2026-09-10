import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useInfiniteScroll } from '@/shared/hooks';
import { NftCard, groupPhotocards, useMyPhotocards } from '@/features/nft';

export function MyNftsPage() {
  const navigate = useNavigate();
  const {
    data: cards,
    isPending,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMyPhotocards();

  const sentinel = useInfiniteScroll({
    hasNext: !!hasNextPage,
    isFetching: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  return (
    <>
      <Header title="내 포토카드" showBack />

      <div className="p-4">
        {isPending ? (
          <Loading label="포토카드를 불러오는 중" />
        ) : !cards || cards.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="보유한 포토카드가 없어요"
            description="공연을 관람하면 좌석별 포토카드가 발행됩니다."
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {/* 같은 도안은 한 칸으로 — 몇 장인지는 카드가 ×n 으로 알려 줍니다 */}
            {groupPhotocards(cards).map(({ card, count }) => (
              <li key={card.photocardId}>
                <NftCard
                  photocardId={card.photocardId}
                  designName={card.designName}
                  imageUrl={card.imageUrl}
                  performanceTitle={card.performanceTitle}
                  state={card.listed ? 'LISTED' : 'STORED'}
                  count={count}
                  onClick={() => navigate(ROUTES.NFT_DETAIL(String(card.photocardId)))}
                />
              </li>
            ))}
          </ul>
        )}

        <div ref={sentinel} aria-hidden className="h-px" />
        {isFetchingNextPage && <Loading label="더 불러오는 중" />}
      </div>
    </>
  );
}
