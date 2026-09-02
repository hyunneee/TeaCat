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
 * 대신 **흰 면 + 그림자**로 바탕에서 띄웁니다 — 목록 항목은 `shadow-list` 입니다
 * (한 겹짜리 `shadow-card` 로는 거의 흰 바탕 위에서 카드 경계가 사라집니다).
 * 항목 사이는 여백으로 나누고, 누를 수 있다는 건 눌렀을 때의 반응으로 알립니다.
 *
 * ── 상태는 카드 **우상단**에 얹습니다 ──────────────────────
 * 글의 흐름에서 빼내 카드 모서리에 고정하면(`absolute`), 제목 길이나 줄 수와
 * 무관하게 **모든 카드에서 같은 자리**에 옵니다 — 목록을 훑을 때 눈이 한 줄로 내려갑니다.
 * 글 안에 두면 카드마다 위치가 미세하게 달라져 스캔이 끊깁니다.
 *
 * 제목·아티스트 줄에는 칩 폭만큼 오른쪽 여백을 둡니다. 안 그러면 긴 제목이
 * 칩 아래로 파고들어 글자가 겹쳐 보입니다.
 */
export function ConcertCard({ concert, onClick }: Props) {
  const open = !concert.upcoming;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      className="surface shadow-list hover:bg-surface-2 relative flex w-full gap-3.5 rounded-2xl p-3 text-left transition-colors duration-200"
    >
      {/* 상태 칩 — 카드 우상단 고정 */}
      {open ? (
        <Badge tone="live" size="lg" icon={<LiveDot />} className="absolute top-2.5 right-2.5">
          예매중
        </Badge>
      ) : (
        <Badge tone="quiet" size="lg" className="absolute top-2.5 right-2.5">
          오픈 예정
        </Badge>
      )}

      <PosterImage
        src={concert.posterUrl}
        seed={concert.posterSeed}
        alt={`${concert.title} 포스터`}
        className="w-[5rem] shrink-0"
      />

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
        {/* pr-20 = 우상단 칩이 앉는 자리. 제목이 칩 밑으로 들어가지 않게 비워 둡니다. */}
        <h3 className="min-w-0 truncate pr-20 text-[0.9375rem] font-bold">{concert.title}</h3>
        <p className="text-ink-muted truncate pr-20 text-sm">{concert.artist}</p>

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
