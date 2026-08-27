import { CalendarDays, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge, PosterImage } from '@/shared/components/ui';
import { formatDateTime } from '@/shared/lib';
import type { ConcertSummary } from '../model/concert.types';

interface Props {
  concert: ConcertSummary;
  onClick: () => void;
}

/** 순수 View — props 로 받은 것만 그립니다. */
export function ConcertCard({ concert, onClick }: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      className="hover:bg-surface-1 flex w-full gap-3.5 rounded-xl p-2 text-left transition-colors duration-200"
    >
      <PosterImage
        src={concert.posterUrl}
        seed={concert.posterSeed}
        alt={`${concert.title} 포스터`}
        className="w-[4.5rem] shrink-0"
      />

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-0.5">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 truncate font-bold">{concert.title}</h3>
          {concert.upcoming ? (
            <Badge tone="info" size="md">
              오픈 예정
            </Badge>
          ) : (
            <Badge tone="brand" size="md">
              예매중
            </Badge>
          )}
        </div>

        <p className="text-muted truncate text-sm">{concert.artist}</p>

        <div className="text-subtle space-y-1 text-[0.8125rem]">
          <p className="flex items-center gap-1 truncate">
            <MapPin size={13} className="shrink-0" />
            {concert.venueName}
          </p>
          {concert.firstShowAt && (
            <p className="flex items-center gap-1 truncate">
              <CalendarDays size={13} className="shrink-0" />
              {formatDateTime(concert.firstShowAt)}
            </p>
          )}
        </div>
      </div>
    </motion.button>
  );
}
