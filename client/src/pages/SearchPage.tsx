import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { SectionTitle } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { ConcertCard } from '@/features/concert';
import { NftCard } from '@/features/nft';
import { TrendingSearchInput, SearchTrendList } from '@/shared/search';
import { useUnifiedSearch } from '@/features/search';

/** 결과를 몇 개까지 보여줄지. 더 보려면 각 탭으로 넘깁니다. */
const LIMIT = 6;

/**
 * 통합 검색 — 공연과 포토카드를 **한 화면에서** 찾습니다.
 *
 * 홈의 검색 버튼이 공연 목록으로 보내던 것을 여기로 바꿨습니다.
 * 사용자가 찾는 게 공연인지 포카인지 미리 정하게 하면,
 * 잘못 고른 사람은 "없다"고 판단하고 나갑니다. 둘 다 보여주고 고르게 합니다.
 *
 * 입력 중에는 서버를 호출하지 않고 제출(Enter/인기 검색어 선택)할 때만 조회합니다.
 * 이 제출 한 건이 서버의 검색 통계 한 건과 정확히 대응합니다.
 */
export function SearchPage() {
  const navigate = useNavigate();
  /* 결과 URL로 진입한 경우 검색어를 복원합니다. */
  const [searchParams, setSearchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(() => searchParams.get('q') ?? '');
  const query = searchParams.get('q')?.trim() ?? '';
  const enabled = query.length > 0;
  const { data, isPending } = useUnifiedSearch(query);

  useEffect(() => setKeyword(searchParams.get('q') ?? ''), [searchParams]);

  const submit = (nextKeyword: string) => {
    const next = nextKeyword.trim();
    setKeyword(nextKeyword);
    setSearchParams(next ? { q: next } : {}, { replace: true });
  };

  /* 빈 검색어에서는 결과 API를 호출하지 않고 인기 검색어를 보여줍니다. */
  const concertHits = enabled ? (data?.concerts ?? []) : [];
  const pocaHits = enabled ? (data?.photocards ?? []) : [];
  const auctionHits = enabled ? (data?.auctions ?? []) : [];
  const loading = enabled && isPending;
  const empty =
    enabled &&
    !loading &&
    concertHits.length === 0 &&
    pocaHits.length === 0 &&
    auctionHits.length === 0;

  return (
    /* 결과가 없을 때 안내를 **화면 한가운데**에 놓기 위해 세로 flex 로 짭니다.
       (본문이 flex-1 이어야 남은 높이 전체가 중앙 정렬의 기준이 됩니다) */
    <div className="flex min-h-dvh flex-col lg:min-h-[calc(100dvh-109px)]">
      <Header title="검색" showBack className="lg:hidden" />

      {/* 입력창은 **헤더 아래 한 줄을 통째로** 씁니다.
          헤더 안에 넣으면 뒤로가기 버튼만큼 좁아지고, 제목 자리도 사라집니다.
          다른 탭의 검색 바와 같은 자리·같은 규칙(`under-header`)이라
          탭을 옮겨 다녀도 검색창이 같은 높이에 있습니다. */}
      <div className="bg-canvas under-header sticky z-10 px-4 pt-2 pb-3 lg:hidden">
        <TrendingSearchInput autoFocus value={keyword} onChange={setKeyword} onSubmit={submit} />
      </div>

      <div className="flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-5xl lg:pt-8">
        {!enabled ? (
          <div className="lg:flex lg:flex-1 lg:items-center lg:justify-center lg:pb-8">
            <SearchTrendList onSelect={submit} />
          </div>
        ) : loading ? (
          <Loading label="검색 중" className="flex-1" />
        ) : empty ? (
          <EmptyState
            className="flex-1"
            icon={Search}
            title="검색 결과가 없어요"
            description={`'${query}' 와 맞는 공연이나 포토카드를 찾지 못했어요.`}
          />
        ) : (
          <div className="space-y-6 p-4 pt-2">
            {concertHits.length > 0 && (
              <section>
                <SectionTitle
                  action={
                    concertHits.length > LIMIT ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`${ROUTES.CONCERTS}?q=${encodeURIComponent(query)}`)
                        }
                        className="text-subtle hover:text-ink text-sm transition-colors"
                      >
                        전체 {concertHits.length}건
                      </button>
                    ) : undefined
                  }
                >
                  공연
                </SectionTitle>
                <ul className="space-y-2">
                  {concertHits.slice(0, LIMIT).map((concert) => (
                    <li key={concert.concertId}>
                      <ConcertCard
                        concert={concert}
                        onClick={() => navigate(ROUTES.CONCERT_DETAIL(String(concert.concertId)))}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {pocaHits.length > 0 && (
              <section>
                <SectionTitle
                  action={
                    pocaHits.length > LIMIT ? (
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.NFT_MARKET)}
                        className="text-subtle hover:text-ink text-sm transition-colors"
                      >
                        전체 {pocaHits.length}건
                      </button>
                    ) : undefined
                  }
                >
                  포토카드
                </SectionTitle>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-5 lg:gap-x-4">
                  {pocaHits.slice(0, LIMIT).map((card) => (
                    <li key={card.photocardId}>
                      <NftCard
                        photocardId={card.photocardId}
                        designName={card.designName}
                        imageUrl={card.decoratedImageUrl ?? card.imageUrl}
                        performanceTitle={card.performanceTitle}
                        price={card.price}
                        onClick={() => navigate(ROUTES.NFT_DETAIL(String(card.photocardId)))}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {auctionHits.length > 0 && (
              <section>
                <SectionTitle>경매</SectionTitle>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-5 lg:gap-x-4">
                  {auctionHits.slice(0, LIMIT).map((auction) => (
                    <li key={auction.auctionId}>
                      <NftCard
                        photocardId={auction.photocardId}
                        designName={auction.designName}
                        imageUrl={auction.decoratedImageUrl ?? auction.imageUrl}
                        performanceTitle={auction.performanceTitle}
                        price={auction.currentPrice}
                        state="AUCTION"
                        onClick={() =>
                          navigate(ROUTES.AUCTION_DETAIL(String(auction.auctionId)))
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
