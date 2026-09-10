import { CalendarDays, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge, LiveDot, PosterImage } from '@/shared/components/ui';
import { formatDateTime } from '@/shared/lib';
import { CONCERT_BOOKING_LABEL, isConcertOpen, posterSeedOf } from '../model/concert.model';
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
 * 제목 줄에는 칩 폭만큼 오른쪽 여백을 둡니다. 안 그러면 긴 제목이
 * 칩 아래로 파고들어 글자가 겹쳐 보입니다.
 *
 * 둘째 줄은 공연장, 셋째 줄은 티켓 오픈 시각입니다. 목록 응답에 공연 일시는 없고
 * (회차마다 다르니 상세에서 봅니다), 목록에서 가장 궁금한 건 "언제 열리나" 입니다.
 */
export function ConcertCard({ concert, onClick }: Props) {
  const open = isConcertOpen(concert);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      className="surface shadow-list hover:bg-surface-2 relative flex w-full gap-3.5 rounded-2xl p-3 text-left transition-colors duration-200"
    >
      {/* 상태 칩 — 카드 우상단 고정. 비공개는 등록자용 목록에서만 오고, 열림 여부보다 먼저 알려야 합니다.
          🔴 문구의 근거는 **서버가 회차를 합쳐 계산한 `bookingStatus`** 입니다.
             예전처럼 티켓 오픈 시각만 보면 회차가 전부 마감된 공연도 "예매중" 으로 보입니다. */}
      {concert.hidden ? (
        <Badge tone="neutral" size="lg" className="absolute top-2.5 right-2.5">
          비공개
        </Badge>
      ) : open ? (
        <Badge tone="live" size="lg" icon={<LiveDot />} className="absolute top-2.5 right-2.5">
          {CONCERT_BOOKING_LABEL.OPEN}
        </Badge>
      ) : (
        <Badge tone="quiet" size="lg" className="absolute top-2.5 right-2.5">
          {CONCERT_BOOKING_LABEL[concert.bookingStatus]}
        </Badge>
      )}

      <PosterImage
        src={concert.posterUrl}
        seed={posterSeedOf(concert)}
        alt={`${concert.title} 포스터`}
        className="w-[5rem] shrink-0"
      />

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
        {/* pr-20 = 우상단 칩이 앉는 자리. 제목이 칩 밑으로 들어가지 않게 비워 둡니다. */}
        <h3 className="min-w-0 truncate pr-20 text-[0.9375rem] font-bold">{concert.title}</h3>

        <div className="text-subtle space-y-0.5 text-[0.8125rem]">
          <p className="flex items-center gap-1 truncate">
            <MapPin size={13} className="shrink-0" />
            <span className="truncate">{concert.stadiumName}</span>
          </p>
          {/* 🔴 접두어("예매 오픈")를 붙이지 않습니다. 남는 폭이 포스터·칩을 빼면 200px 남짓이라
              접두어를 붙이면 **날짜 끝(시각)이 잘립니다** — 목록에서 가장 궁금한 게 몇 시인데
              그게 먼저 사라집니다. 열렸는지 아닌지는 우상단 칩이 이미 말하고 있어
              접두어는 같은 말을 두 번 하는 것이기도 합니다. */}
          <p className="flex items-center gap-1">
            <CalendarDays size={13} className="shrink-0" />
            <time dateTime={concert.ticketingStartAt} className="truncate">
              {formatDateTime(concert.ticketingStartAt)}
            </time>
          </p>
        </div>
      </div>
    </motion.button>
  );
}
