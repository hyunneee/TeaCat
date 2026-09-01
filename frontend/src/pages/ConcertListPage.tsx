import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Input } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { ConcertCard, useConcerts } from '@/features/concert';

export function ConcertListPage() {
  const navigate = useNavigate();
  /* 홈 검색창에서 `?q=` 로 넘어옵니다. 화면을 하나 더 만들지 않고 여기서 받습니다. */
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(() => searchParams.get('q') ?? '');
  const { data: concerts, isPending } = useConcerts(keyword || undefined);

  return (
    <>
      <Header title="공연" />

      {/* 검색 바 — 헤더에 **붙여** 둡니다. 사이가 벌어지면 헤더가 두 겹으로 보입니다.
          바깥 면은 목록과 같은 바탕색이라 흰 입력창만 떠 보입니다.
          (헤더와 같은 흰색으로 두면 헤더가 그만큼 두꺼워진 것처럼 읽힙니다)
          스크롤해도 따라오게 해서 언제든 다시 찾을 수 있게 합니다. */}
      <div className="bg-canvas under-header sticky z-10 px-4 pt-2 pb-3">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="공연명, 아티스트로 검색"
          leftIcon={<Search size={17} />}
          type="search"
          tone="contrast"
          className="text-[0.9375rem]"
        />
      </div>

      {isPending ? (
        <Loading label="공연 목록을 불러오는 중" />
      ) : !concerts || concerts.length === 0 ? (
        <EmptyState
          icon={Search}
          title="검색 결과가 없어요"
          description="다른 키워드로 찾아보세요."
        />
      ) : (
        // 카드마다 테두리가 있으므로 구분선 대신 간격으로 나눕니다.
        <ul className="space-y-2 p-4 pt-3">
          {concerts.map((concert) => (
            <li key={concert.id}>
              <ConcertCard
                concert={concert}
                onClick={() => navigate(ROUTES.CONCERT_DETAIL(concert.id))}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
