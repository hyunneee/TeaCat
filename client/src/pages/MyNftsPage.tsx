import { useNavigate } from 'react-router-dom';
import { Header } from '@/shared/components/layout';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useInfiniteScroll } from '@/shared/hooks';
import {
  NftCard,
  PocaPackTile,
  groupPhotocards,
  photocardMarketState,
  photocardSource,
  useDrawAvailability,
  useMyPhotocards,
} from '@/features/nft';

export function MyNftsPage() {
  const navigate = useNavigate();
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

  /* 카드도 카드팩도 없을 때만 빈 화면을 말합니다 — 팩이 있으면 할 일이 있는 화면이라
     "없어요" 가 틀린 말이 됩니다 */
  const nothing =
    (cards ?? []).length === 0 &&
    draw !== undefined &&
    draw.remaining === 0 &&
    draw.scheduled === 0;

  const sentinel = useInfiniteScroll({
    hasNext: !!hasNextPage,
    isFetching: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  /* 🔴 여기서 뜯지 않습니다 — 뽑기 화면으로 갈 뿐이고, 봉지를 끝까지 밀어야 실제로 뜯깁니다.
     되돌릴 수 없는 동작 앞에 확인을 한 번 더 두는 자리가 이미 그 화면에 있는 셈입니다. */
  const goToDraw = () => navigate(ROUTES.NFT_DRAW);

  return (
    <>
      <Header title="내 포토카드" />

      <div className="p-4 lg:mx-auto lg:max-w-3xl lg:px-0 lg:pt-4">
        {isPending ? (
          <Loading label="포토카드를 불러오는 중" />
        ) : nothing ? (
          <EmptyState
            title="아직 보유한 포토카드가 없어요."
            description="공연을 관람하거나 이벤트 카드팩을 열면 여기에 쌓입니다."
          />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 lg:gap-4">
              {/* 카드팩이 맨 앞 — 목록 밖에 배너처럼 두면 광고로 읽힙니다 */}
              {/* 🔴 열 수 있는 팩과 잠긴 팩을 **따로** 그립니다.
                  한 칸으로 합치면 "1개는 열 수 있고 2개는 기다린다" 가 "1개뿐" 으로 보여서
                  산 팩이 사라진 것처럼 읽힙니다. 서버는 잠긴 팩이 있어도 열 수 있는 팩을
                  정상적으로 꺼내 줍니다 — 하나가 잠겼다고 나머지가 막히지 않습니다. */}
              {draw && draw.remaining > 0 && (
                <li>
                  <PocaPackTile count={draw.remaining} onClick={goToDraw} />
                </li>
              )}

              {draw && draw.scheduled > 0 && (
                <li>
                  <PocaPackTile
                    count={draw.scheduled}
                    openAt={draw.nextOpenAt}
                    onClick={goToDraw}
                  />
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
                    state={photocardMarketState(card)}
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
