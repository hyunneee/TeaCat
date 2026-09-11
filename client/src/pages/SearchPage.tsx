import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Input, SectionTitle } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useDebouncedValue } from '@/shared/hooks';
import { ConcertCard, useConcerts } from '@/features/concert';
import { NftCard, useNftMarket } from '@/features/nft';

/** 결과를 몇 개까지 보여줄지. 더 보려면 각 탭으로 넘깁니다. */
const LIMIT = 6;

/**
 * 통합 검색 — 공연과 포토카드를 **한 화면에서** 찾습니다.
 *
 * 홈의 검색 버튼이 공연 목록으로 보내던 것을 여기로 바꿨습니다.
 * 사용자가 찾는 게 공연인지 포카인지 미리 정하게 하면,
 * 잘못 고른 사람은 "없다"고 판단하고 나갑니다. 둘 다 보여주고 고르게 합니다.
 *
 * ── 입력과 조회를 분리합니다 ───────────────────────────────
 * 글자는 즉시 반응해야 하지만 조회는 잠잠해진 뒤에 합니다.
 * 안 그러면 다섯 글자에 요청이 다섯 번 나가고, 응답 순서가 뒤바뀌면
 * 이전 키워드의 결과가 화면에 남습니다. (useDebouncedValue)
 */
export function SearchPage() {
  const navigate = useNavigate();
  /* 데스크톱 상단 검색창이 `?q=` 로 넘겨줍니다. 그 글자로 시작해야 두 번 치지 않습니다 */
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(() => searchParams.get('q') ?? '');
  const query = useDebouncedValue(keyword.trim());
  const enabled = query.length > 0;

  const { data: concerts, isPending: concertsPending } = useConcerts(query || undefined);
  const { data: pocas, isPending: pocasPending } = useNftMarket({ keyword: query || undefined });

  /* 키워드가 없을 때는 조회 결과를 쓰지 않습니다 (전체 목록이 내려옵니다) */
  const concertHits = enabled ? (concerts ?? []) : [];
  const pocaHits = enabled ? (pocas ?? []) : [];
  const loading = enabled && (concertsPending || pocasPending);
  const empty = enabled && !loading && concertHits.length === 0 && pocaHits.length === 0;

  return (
    /* 결과가 없을 때 안내를 **화면 한가운데**에 놓기 위해 세로 flex 로 짭니다.
       (본문이 flex-1 이어야 남은 높이 전체가 중앙 정렬의 기준이 됩니다) */
    <div className="flex min-h-dvh flex-col">
      <Header title="검색" showBack />

      {/* 입력창은 **헤더 아래 한 줄을 통째로** 씁니다.
          헤더 안에 넣으면 뒤로가기 버튼만큼 좁아지고, 제목 자리도 사라집니다.
          다른 탭의 검색 바와 같은 자리·같은 규칙(`under-header`)이라
          탭을 옮겨 다녀도 검색창이 같은 높이에 있습니다. */}
      <div className="bg-canvas under-header sticky z-10 px-4 pt-2 pb-3">
        {/* 세 화면(검색·공연·포카)의 검색창은 **props 까지 같습니다.**
            크기·톤·지우기 버튼이 화면마다 다르면 같은 기능이 다른 것처럼 보입니다.
            글자 크기는 Input 이 정하니 여기서 덧붙이지 마세요. */}
        <Input
          autoFocus
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onClear={() => setKeyword('')}
          placeholder="공연, 아티스트, 포토카드 검색"
          leftIcon={<Search size={17} />}
          type="search"
          tone="contrast"
        />
      </div>

      <div className="flex flex-1 flex-col">
      {!enabled ? (
        <EmptyState
          className="flex-1"
          icon={Search}
          title="무엇을 찾으세요?"
          description="공연 이름이나 아티스트, 포토카드 이름으로 찾을 수 있어요."
        />
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
                      onClick={() => navigate(`${ROUTES.CONCERTS}?q=${encodeURIComponent(query)}`)}
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
              <ul className="grid grid-cols-2 gap-x-3 gap-y-6">
                {pocaHits.slice(0, LIMIT).map((card) => (
                  <li key={card.photocardId}>
                    <NftCard
                      photocardId={card.photocardId}
                      designName={card.designName}
                      imageUrl={card.imageUrl}
                      performanceTitle={card.performanceTitle}
                      price={card.price}
                      onClick={() => navigate(ROUTES.NFT_DETAIL(String(card.photocardId)))}
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
