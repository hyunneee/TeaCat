import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
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
  const [keyword, setKeyword] = useState('');
  const query = useDebouncedValue(keyword.trim());
  const enabled = query.length > 0;

  const { data: concerts, isPending: concertsPending } = useConcerts(query || undefined);
  const { data: pocas, isPending: pocasPending } = useNftMarket(query || undefined);

  /* 키워드가 없을 때는 조회 결과를 쓰지 않습니다 (전체 목록이 내려옵니다) */
  const concertHits = enabled ? (concerts ?? []) : [];
  const pocaHits = enabled ? (pocas ?? []) : [];
  const loading = enabled && (concertsPending || pocasPending);
  const empty = enabled && !loading && concertHits.length === 0 && pocaHits.length === 0;

  return (
    <>
      {/* 검색 화면의 주인공은 입력창입니다. 제목("검색")을 따로 두면
          정작 쳐야 할 곳이 한 줄 아래로 밀립니다. */}
      <Header
        showBack
        left={
          <Input
            autoFocus
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="공연, 아티스트, 포토카드 검색"
            leftIcon={<Search size={17} />}
            type="search"
            tone="contrast"
            className="text-[0.9375rem]"
            rightSlot={
              keyword ? (
                <button
                  type="button"
                  aria-label="검색어 지우기"
                  onClick={() => setKeyword('')}
                  className="text-subtle hover:text-ink -mr-1 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
              ) : undefined
            }
          />
        }
      />

      {!enabled ? (
        <EmptyState
          icon={Search}
          title="무엇을 찾으세요?"
          description="공연 이름이나 아티스트, 포토카드 이름으로 찾을 수 있어요."
        />
      ) : loading ? (
        <Loading label="검색 중" />
      ) : empty ? (
        <EmptyState
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
                  <li key={concert.id}>
                    <ConcertCard
                      concert={concert}
                      onClick={() => navigate(ROUTES.CONCERT_DETAIL(concert.id))}
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
                {pocaHits.slice(0, LIMIT).map((nft) => (
                  <li key={nft.id}>
                    <NftCard nft={nft} onClick={() => navigate(ROUTES.NFT_DETAIL(nft.id))} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
