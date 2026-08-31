import { CalendarDays, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge, LiveDot, PosterImage } from '@/shared/components/ui';
import { formatDateTime } from '@/shared/lib';
import type { ConcertSummary } from '../model/concert.types';

interface Props {
  concert: ConcertSummary;
  onClick: () => void;
}

/**
 * 공연 한 장 (순수 View — props 로 받은 것만 그립니다).
 *
 * ── 테두리를 두르지 않습니다 ───────────────────────────────
 * 목록에 카드가 여러 장 깔리면 테두리가 줄줄이 겹쳐 화면이 선으로 가득 찹니다.
 * 대신 **흰 면 + 얕은 그림자**로 바탕에서 띄웁니다.
 * 항목 사이는 여백으로 나누고, 누를 수 있다는 건 눌렀을 때의 반응으로 알립니다.
 *
 * ── 상태는 제목 위, 첫 줄에 ────────────────────────────────
 * 목록을 훑는 눈은 왼쪽 위에서 아래로 내려갑니다. 상태가 제목보다 **먼저** 와야
 * "이건 지금 살 수 있는 거구나" 를 판단하고 제목을 읽습니다.
 * 포스터 위에 얹으면 아트를 가리고, 오른쪽 끝에 두면 제목을 다 읽은 뒤에야 보입니다.
 */
export function ConcertCard({ concert, onClick }: Props) {
  const open = !concert.upcoming;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      className="surface shadow-card hover:bg-surface-2 flex w-full gap-3.5 rounded-2xl p-3 text-left transition-colors duration-200"
    >
      <PosterImage
        src={concert.posterUrl}
        seed={concert.posterSeed}
        alt={`${concert.title} 포스터`}
        className="w-[5rem] shrink-0"
      />

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
        <span className="w-fit">
          {open ? (
            <Badge tone="neutral" icon={<LiveDot />}>
              예매중
            </Badge>
          ) : (
            <Badge tone="neutral">오픈 예정</Badge>
          )}
        </span>

        <h3 className="min-w-0 truncate text-[0.9375rem] font-bold">{concert.title}</h3>
        <p className="text-ink-muted truncate text-sm">{concert.artist}</p>

        <div className="text-subtle space-y-0.5 text-[0.8125rem]">
          <p className="flex items-center gap-1 truncate">
            <MapPin size={13} className="shrink-0" />
            <span className="truncate">{concert.venueName}</span>
          </p>
          {concert.firstShowAt && (
            <p className="flex items-center gap-1 truncate">
              <CalendarDays size={13} className="shrink-0" />
              <span className="truncate">{formatDateTime(concert.firstShowAt)}</span>
            </p>
          )}
        </div>
      </div>
    </motion.button>
  );
}
