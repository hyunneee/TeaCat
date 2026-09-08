import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { IconButton, Input } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { can, useAuth } from '@/features/auth';
import { ConcertCard, useConcerts } from '@/features/concert';

export function ConcertListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  /* 홈 검색창에서 `?q=` 로 넘어옵니다. 화면을 하나 더 만들지 않고 여기서 받습니다. */
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(() => searchParams.get('q') ?? '');
  const { data: concerts, isPending } = useConcerts(keyword || undefined);

  /* 관리자·공연 주최자에게만 등록 버튼이 보입니다. 서버(`/admin/concerts/**`)도 같은 역할만 받습니다. */
  const canCreate = can.createConcert(user);

  return (
    <>
      <Header
        title="공연"
        right={
          canCreate ? (
            <IconButton label="공연 등록" onClick={() => navigate(ROUTES.CONCERT_CREATE)}>
              <Plus size={22} />
            </IconButton>
          ) : undefined
        }
      />

      {/* 검색 바 — 헤더에 **붙여** 둡니다. 사이가 벌어지면 헤더가 두 겹으로 보입니다.
          바깥 면은 목록과 같은 바탕색이라 흰 입력창만 떠 보입니다.
          (헤더와 같은 흰색으로 두면 헤더가 그만큼 두꺼워진 것처럼 읽힙니다)
          스크롤해도 따라오게 해서 언제든 다시 찾을 수 있게 합니다. */}
      <div className="bg-canvas under-header sticky z-10 px-4 pt-2 pb-3">
        {/* 검색·포카 화면의 검색창과 **같은 props** 입니다 (SearchPage 주석 참고)
            서버 검색은 공연명 부분 일치입니다 (API-201) */}
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onClear={() => setKeyword('')}
          placeholder="공연명으로 검색"
          leftIcon={<Search size={17} />}
          type="search"
          tone="contrast"
        />
      </div>

      {isPending ? (
        <Loading label="공연 목록을 불러오는 중" />
      ) : !concerts || concerts.length === 0 ? (
        <EmptyState
          icon={Search}
          title={keyword ? '검색 결과가 없어요' : '아직 등록된 공연이 없어요'}
          description={
            keyword
              ? '다른 키워드로 찾아보세요.'
              : canCreate
                ? '오른쪽 위 + 버튼으로 첫 공연을 등록해 보세요.'
                : '공연이 등록되면 여기에 보여요.'
          }
        />
      ) : (
        // 카드마다 테두리가 있으므로 구분선 대신 간격으로 나눕니다.
        <ul className="space-y-2 p-4 pt-3">
          {concerts.map((concert) => (
            <li key={concert.concertId}>
              <ConcertCard
                concert={concert}
                onClick={() => navigate(ROUTES.CONCERT_DETAIL(String(concert.concertId)))}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
