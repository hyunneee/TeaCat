import { CalendarDays, MapPin, Armchair } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge, PosterImage } from '@/shared/components/ui';
import { cn, formatDateTime } from '@/shared/lib';
import { isPast, seatText, ticketStatusLabel, ticketTone } from '../model/ticket.model';
import type { Ticket } from '../model/ticket.types';

interface Props {
  ticket: Ticket;
  onClick: () => void;
}

export function TicketCard({ ticket, onClick }: Props) {
  const canceled = ticket.status === 'CANCELED';
  const dimmed = canceled || isPast(ticket);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      className={cn(
        /* 목록 항목이라 테두리를 두지 않습니다 — 흰 면과 그림자로 바탕에서 띄웁니다.
           공연 카드와 **같은 `shadow-list`** 입니다 (styles/index.css). */
        'surface shadow-list hover:bg-surface-2 flex w-full gap-3.5 rounded-2xl p-3 text-left',
        'transition-colors duration-200',
        dimmed && 'opacity-65',
      )}
    >
      <PosterImage
        src={null}
        seed={ticket.posterSeed}
        alt={`${ticket.concertTitle} 포스터`}
        className="w-16 shrink-0"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <h3 className={cn('min-w-0 flex-1 truncate font-bold', canceled && 'line-through')}>
            {ticket.concertTitle}
          </h3>
          <Badge tone={ticketTone(ticket)}>{ticketStatusLabel(ticket)}</Badge>
        </div>

        <div className="text-subtle space-y-1 text-[0.8125rem]">
          <p className="flex items-center gap-1 truncate">
            <CalendarDays size={13} className="shrink-0" />
            {formatDateTime(ticket.startAt)}
          </p>
          <p className="flex items-center gap-1 truncate">
            <MapPin size={13} className="shrink-0" />
            {ticket.venueName}
          </p>
          <p className="text-brand-800 flex items-center gap-1 truncate font-semibold">
            <Armchair size={13} className="shrink-0" />
            {seatText(ticket)}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
