import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Input, SkeletonList } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { ConcertCard, useConcerts } from '@/features/concert';

export function ConcertListPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const { data: concerts, isPending } = useConcerts(keyword || undefined);

  return (
    <>
      <Header title="공연" />

      <div className="p-4">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="공연명, 아티스트로 검색"
          leftIcon={<Search size={17} />}
          type="search"
        />
      </div>

      {isPending ? (
        <div className="px-4">
          <SkeletonList count={4} />
        </div>
      ) : !concerts || concerts.length === 0 ? (
        <EmptyState
          icon={Search}
          title="검색 결과가 없어요"
          description="다른 키워드로 찾아보세요."
        />
      ) : (
        <ul className="space-y-1 px-2 pb-4">
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
