import { useNavigate } from 'react-router-dom';
import { Header } from '@/shared/components/layout';
import { Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useInfiniteScroll } from '@/shared/hooks';
import { useModal } from '@/app/providers';
import {
  NftCard,
  PocaPackTile,
  groupPhotocards,
  photocardSource,
  useDrawAvailability,
  useMyPhotocards,
} from '@/features/nft';

export function MyNftsPage() {
  const navigate = useNavigate();
  const { open } = useModal();
  const {
    data: cards,
    isPending,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMyPhotocards();

  /* 카드팩은 **서버가 남았다고 할 때만** 보입니다 — 다 쓴 팩이 남아 있으면
     눌러도 실패하는 칸이 됩니다. 응답 전에는 보여주지 않습니다(깜빡임 방지). */
  const { data: draw } = useDrawAvailability();

  const sentinel = useInfiniteScroll({
    hasNext: !!hasNextPage,
    isFetching: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  /* 뜯으면 되돌릴 수 없으니 한 번 물어봅니다 — 목록을 넘기다 잘못 누를 수 있는 자리입니다.
     🔴 횟수·조건은 여기서 말하지 않습니다. 이벤트마다 다르고 정하는 쪽은 서버입니다 —
     화면이 "한 번만" 이라고 단정하면 서버 규칙이 바뀔 때 거짓말이 됩니다. */
  const askToOpen = () =>
    open('common/confirm', {
      title: '카드팩을 열어보시겠어요?',
      confirmText: '열기',
      onConfirm: () => navigate(ROUTES.NFT_DRAW),
    });

  return (
    <>
      <Header title="내 포토카드" showBack />

      <div className="p-4">
        {isPending ? (
          <Loading label="포토카드를 불러오는 중" />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3">
              {/* 카드팩이 맨 앞 — 목록 밖에 배너처럼 두면 광고로 읽힙니다 */}
              {draw?.available && (
                <li>
                  <PocaPackTile count={draw.remaining} onClick={askToOpen} />
                </li>
              )}

              {/* 같은 도안은 한 칸으로 — 몇 장인지는 카드가 ×n 으로 알려 줍니다 */}
              {groupPhotocards(cards ?? []).map(({ card, count }) => (
                <li key={card.photocardId}>
                  <NftCard
                    photocardId={card.photocardId}
                    designName={card.designName}
                    imageUrl={card.imageUrl}
                    performanceTitle={photocardSource(card.performanceTitle)}
                    state={card.listed ? 'LISTED' : 'STORED'}
                    count={count}
                    onClick={() => navigate(ROUTES.NFT_DETAIL(String(card.photocardId)))}
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        <div ref={sentinel} aria-hidden className="h-px" />
        {isFetchingNextPage && <Loading label="더 불러오는 중" />}
      </div>
    </>
  );
}
