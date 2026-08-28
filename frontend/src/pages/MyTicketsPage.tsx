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

  const filtered = (tickets ?? []).filter((ticket) =>
    tab === 'UPCOMING'
      ? ticket.status === 'VALID' && !isPast(ticket)
      : ticket.status !== 'VALID' || isPast(ticket),
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
          <ul className="space-y-3">
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
