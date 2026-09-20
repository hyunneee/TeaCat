import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Ticket } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { TicketNavigation } from '@/shared/components/layout/TicketNavigation';
import { Input, Segmented } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { TicketCard, isPast, useMyTickets } from '@/features/ticket';

const TABS = [
  { value: 'UPCOMING', label: '관람 예정' },
  { value: 'PAST', label: '지난 티켓' },
] as const;

type Tab = (typeof TABS)[number]['value'];

export function MyTicketsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('period') === 'past' ? 'PAST' : 'UPCOMING';
  const setTab = (value: Tab) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === 'PAST') next.set('period', 'past');
        else next.delete('period');
        return next;
      },
      { replace: true },
    );
  const [keyword, setKeyword] = useState('');
  const { data: tickets, isPending } = useMyTickets();

  /* 검색은 **이미 받아 둔 목록 안에서** 합니다 (서버에 다시 묻지 않습니다).
     내 티켓은 많아야 수십 건이라 왕복할 이유가 없고, 그래서 디바운스도 없습니다 —
     공연 목록의 검색창과 겉모습은 같지만 하는 일이 다릅니다. */
  const query = keyword.trim().toLowerCase();

  /* "관람 예정" 은 아직 유효한 예매만입니다. 취소된 예매와 지난 공연은 함께 뒤로 보냅니다 —
     둘 다 "이제 와서 할 일이 없는" 티켓이라 사용자 입장에서 같은 서랍입니다 */
  const filtered = (tickets ?? [])
    .filter((ticket) =>
      tab === 'UPCOMING'
        ? ticket.status === 'CONFIRMED' && !isPast(ticket)
        : ticket.status !== 'CONFIRMED' || isPast(ticket),
    )
    /* 공연 이름과 공연장 둘 다 봅니다. "올림픽" 으로도 찾을 수 있어야 합니다 */
    .filter(
      (ticket) =>
        !query ||
        ticket.concertTitle.toLowerCase().includes(query) ||
        ticket.venueName.toLowerCase().includes(query),
    );

  return (
    <>
      <Header title="내 티켓" />
      <TicketNavigation />

      {/* 티켓 카드는 가로로 길어서 넓은 화면에서 두 열로 접습니다.
          세그먼트는 폭을 따라 늘리지 않습니다 — 1024px 짜리 두 칸 알약은
          누르는 것이 아니라 띠로 보입니다.

          넓은 화면에서는 **왼쪽 토글 · 오른쪽 검색** 한 줄입니다 (공연 목록과 같은 배치).
          폰에서는 세로로 쌓이는데, 그때는 검색창이 먼저 오는 편이 낫습니다 —
          목록 화면들의 검색창이 모두 머리말 바로 아래 같은 높이에 있어야
          탭을 옮겨 다녀도 눈이 헤매지 않습니다. 그래서 DOM 순서는 그대로 두고
          가로로 펼 때만 자리를 바꿉니다(`lg:order-*`). */}
      <div className="bg-canvas under-header sticky z-10 px-4 pt-2 pb-3 lg:flex lg:items-center lg:gap-3 lg:px-0 lg:pt-3">
        <div className="lg:order-2 lg:ml-auto lg:w-full lg:max-w-xs">
          {/* 검색·공연 화면의 검색창과 **같은 props** 입니다 (SearchPage 주석 참고) */}
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onClear={() => setKeyword('')}
            placeholder="공연명, 공연장으로 검색"
            leftIcon={<Search size={17} />}
            type="search"
            tone="contrast"
          />
        </div>

        <Segmented
          options={TABS}
          value={tab}
          onChange={setTab}
          className="mt-2 lg:order-1 lg:mt-0 lg:w-72 lg:shrink-0"
        />
      </div>

      <div className="p-4 pt-3 lg:px-0">
        {isPending ? (
          <Loading label="티켓을 불러오는 중" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            {...(query
              ? {
                  title: '검색 결과가 없어요',
                  description: `'${keyword.trim()}' 와 맞는 티켓을 찾지 못했어요.`,
                }
              : {
                  icon: Ticket,
                  title: tab === 'UPCOMING' ? '예매한 티켓이 없어요' : '지난 티켓이 없어요',
                  description: tab === 'UPCOMING' ? '공연을 둘러보고 예매해 보세요.' : undefined,
                })}
          />
        ) : (
          <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {filtered.map((ticket) => (
              <li key={ticket.id}>
                <TicketCard
                  ticket={ticket}
                  onClick={() => navigate(ROUTES.TICKET_DETAIL(ticket.id))}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
