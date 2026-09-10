import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Segmented } from '@/shared/components/ui';
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
  const [tab, setTab] = useState<Tab>('UPCOMING');
  const { data: tickets, isPending } = useMyTickets();

  /* "관람 예정" 은 아직 유효한 예매만입니다. 취소된 예매와 지난 공연은 함께 뒤로 보냅니다 —
     둘 다 "이제 와서 할 일이 없는" 티켓이라 사용자 입장에서 같은 서랍입니다 */
  const filtered = (tickets ?? []).filter((ticket) =>
    tab === 'UPCOMING'
      ? ticket.status === 'CONFIRMED' && !isPast(ticket)
      : ticket.status !== 'CONFIRMED' || isPast(ticket),
  );

  return (
    <>
      <Header title="내 티켓" />

      <div className="space-y-4 p-4">
        <Segmented options={TABS} value={tab} onChange={setTab} />

        {isPending ? (
          <Loading label="티켓을 불러오는 중" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title={tab === 'UPCOMING' ? '예매한 티켓이 없어요' : '지난 티켓이 없어요'}
            description={tab === 'UPCOMING' ? '공연을 둘러보고 예매해 보세요.' : undefined}
          />
        ) : (
          <ul className="space-y-2">
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
