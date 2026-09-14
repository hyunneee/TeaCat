import { ChevronRight } from 'lucide-react';
import { Button, Card, PosterImage } from '@/shared/components/ui';
import { cn, formatDateTime } from '@/shared/lib';
import { HoldTimer } from './HoldTimer';
import { myHoldSeatLabel } from '../model/seat.model';
import type { MyHold } from '../model/booking.types';

export interface ResumeBookingCardProps {
  hold: MyHold;
  /** 남은 초 — `useActiveHold` 가 응답 받은 시각 기준으로 계산해 줍니다 */
  remainSeconds: number;
  onContinue: () => void;
  /** 잡아둔 자리를 놓습니다 — 확인 모달은 부르는 쪽(페이지)이 띄웁니다 */
  onRelease: () => void;
  isReleasing?: boolean;
  className?: string;
}

/**
 * "결제를 마치지 않은 자리가 있어요" — 홈에서 예매 플로우로 되돌려보냅니다.
 *
 * 🔴 결제창을 닫고 홈으로 나가면 자리는 **여전히 잡혀 있습니다.** 화면에 아무 흔적도
 *    없으면 사용자는 예매가 없던 일이 된 줄 알지만, 10분 동안 그 자리는 남도 못 삽니다.
 *    돌아갈 길을 여기 하나 둡니다.
 *
 * 남은 시간을 같이 세우는 이유는 급한 일이기 때문입니다 — 목록의 한 줄처럼 보이면
 * 나중에 눌러도 되는 것으로 읽힙니다.
 */
export function ResumeBookingCard({
  hold,
  remainSeconds,
  onContinue,
  onRelease,
  isReleasing,
  className,
}: ResumeBookingCardProps) {
  return (
    <Card interactive onClick={onContinue} className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">결제를 마치지 않은 자리가 있어요</p>
        <HoldTimer remainSeconds={remainSeconds} />
      </div>

      <div className="flex items-center gap-3">
        {/* 포스터는 곁들이는 정보라 작게. 옆의 제목이 이미 무엇인지 말합니다 */}
        <PosterImage
          src={hold.posterUrl}
          seed={hold.scheduleId}
          alt=""
          className="w-11 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{hold.concertTitle}</p>
          <p className="text-muted mt-0.5 truncate text-xs">
            {formatDateTime(hold.performanceDate)} · {myHoldSeatLabel(hold)}
          </p>
        </div>
        <ChevronRight size={18} className="text-subtle shrink-0" aria-hidden />
      </div>

      {/* 🔴 카드 전체가 눌리는 자리라 전파를 끊습니다 — 안 끊으면 놓으려다 예매로 들어갑니다.
          자리를 놓는 건 되돌릴 수 없어 붉게 둡니다 (CLAUDE.md 4-7) */}
      <Button
        variant="danger-ghost"
        size="md"
        fullWidth
        loading={isReleasing}
        onClick={(e) => {
          e.stopPropagation();
          onRelease();
        }}
      >
        자리 놓기
      </Button>
    </Card>
  );
}
