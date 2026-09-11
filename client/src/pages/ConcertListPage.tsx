import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Input, Segmented } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { ConcertCard, useConcerts } from '@/features/concert';

/**
 * 공연 목록 (관람객 화면).
 *
 * 🔴 **공연 등록·수정 입구는 여기에 두지 않습니다.** 공연 관리는 어드민 콘솔(`/admin`)로
 * 옮기기로 했습니다. 예전에는 헤더의 + 버튼과 "내 공연" 탭이 있었는데, 관람객이 보는
 * 화면에 관리 기능이 섞여 있었습니다.
 *
 * 등록·수정 화면(`/concerts/new`, `/concerts/:id/edit`)과 그 라우트 가드는 그대로
 * 살아 있습니다 — 어드민 콘솔에 "공연 관리" 메뉴가 생기면 거기서 이어 붙이면 됩니다.
 * 그때까지는 주소로 직접 들어가는 것 외에 입구가 없습니다.
 */
/* 두 목록은 서버에서 갈라 옵니다(`past`) — 남은 회차가 있으면 예정, 전부 지났으면 지난 공연.
   클라이언트에서 거르지 않는 이유: 커서 페이징이라 걸러내면 한 페이지가 들쭉날쭉해집니다. */
const TABS = [
  { value: 'UPCOMING', label: '공연 예정' },
  { value: 'PAST', label: '지난 공연' },
] as const;

type Tab = (typeof TABS)[number]['value'];

export function ConcertListPage() {
  const navigate = useNavigate();
  /* 홈 검색창에서 `?q=` 로 넘어옵니다. 화면을 하나 더 만들지 않고 여기서 받습니다. */
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(() => searchParams.get('q') ?? '');
  const [tab, setTab] = useState<Tab>('UPCOMING');

  const { data: concerts, isPending } = useConcerts(keyword || undefined, tab === 'PAST');

  return (
    <>
      <Header title="공연" />

      {/* 검색 바 — 헤더에 **붙여** 둡니다. 사이가 벌어지면 헤더가 두 겹으로 보입니다.
          바깥 면은 목록과 같은 바탕색이라 흰 입력창만 떠 보입니다.
          (헤더와 같은 흰색으로 두면 헤더가 그만큼 두꺼워진 것처럼 읽힙니다)
          스크롤해도 따라오게 해서 언제든 다시 찾을 수 있게 합니다. */}
      {/* 넓은 화면에서는 두 줄을 **한 줄**로 폅니다. 세로로 쌓아 두면 1024px 짜리
          검색창과 1024px 짜리 세그먼트가 위아래로 붙어 필터가 화면의 절반을 먹습니다. */}
      <div className="bg-canvas under-header sticky z-10 px-4 pt-2 pb-3 lg:flex lg:items-center lg:gap-3 lg:px-0 lg:pt-3">
        {/* 검색·포카 화면의 검색창과 **같은 props** 입니다 (SearchPage 주석 참고)
            서버 검색은 공연명 부분 일치입니다 (API-201). */}
        {/* 가로로 펼 때만 자리를 바꿉니다 — **왼쪽 토글 · 오른쪽 검색** (내 티켓과 같은 배치).
            폰에서는 세로로 쌓이고, 그때는 검색창이 머리말 바로 아래 와야 합니다
            (목록 화면들의 검색창이 모두 같은 높이에 있어야 눈이 헤매지 않습니다). */}
        <div className="lg:order-2 lg:ml-auto lg:w-full lg:max-w-xs">
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

        {/* 내 티켓·포카와 같은 세그먼트입니다. 검색창과 한 덩어리로 붙여 두면
            스크롤해도 "무엇을 보고 있는지" 가 함께 따라옵니다.
            알약 위치는 폭의 비율로 계산하므로 폭을 좁혀도 어긋나지 않습니다. */}
        <Segmented
          options={TABS}
          value={tab}
          onChange={setTab}
          className="mt-2 lg:order-1 lg:mt-0 lg:w-72 lg:shrink-0"
        />
      </div>

      {isPending ? (
        <Loading label="공연 목록을 불러오는 중" />
      ) : !concerts || concerts.length === 0 ? (
        <EmptyState
          icon={Search}
          title={
            keyword
              ? '검색 결과가 없어요'
              : tab === 'PAST'
                ? '지난 공연이 없어요'
                : '아직 등록된 공연이 없어요'
          }
          description={
            keyword
              ? '다른 키워드로 찾아보세요.'
              : tab === 'PAST'
                ? undefined
                : '공연이 등록되면 여기에 보여요.'
          }
        />
      ) : (
        /* 카드마다 테두리가 있으므로 구분선 대신 간격으로 나눕니다.
           넓은 화면에서는 두 열로 접습니다 — 한 열로 두면 카드가 가로로 늘어나
           포스터는 그대로인 채 오른쪽이 비어 보입니다. 열이 늘어도 카드 자체는
           폰에서와 같은 모양(포스터 왼쪽 · 정보 오른쪽)입니다. */
        <ul className="grid gap-2 p-4 pt-3 lg:grid-cols-2 lg:gap-3 lg:px-0">
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
