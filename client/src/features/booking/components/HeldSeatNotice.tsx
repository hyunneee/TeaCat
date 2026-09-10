import { Ticket } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import { HoldTimer } from './HoldTimer';
import { seatLabel } from '../model/seat.model';
import type { SeatMapData } from '../model/booking.types';
import type { HoldSession } from '../store/bookingStore';

export interface HeldSeatNoticeProps {
  hold: HoldSession | null;
  /** 좌석·구역 이름을 찾기 위한 좌석맵. 아직 안 왔으면 자리 이름 없이 보여줍니다 */
  seatMap?: SeatMapData;
  /** 남은 초. 주면 타이머가 함께 보입니다 */
  remainSeconds?: number;
  /** "이어서 예매하기" — 예매 확인 화면으로 되돌아갑니다 */
  onContinue?: () => void;
  /** "이 자리 놓기" — 되돌릴 수 없으므로 호출부가 확인 모달을 먼저 띄웁니다 */
  onRelease?: () => void;
  releasing?: boolean;
  className?: string;
}

/**
 * "지금 이 자리를 잡아두고 있어요" 안내 + 이어가기 / 놓기.
 *
 * 🔴 안내만 있으면 **막다른 길**입니다. 결제까지 갔다가 뒤로 나온 사용자는
 *    자리를 쥐고 있는데, 그 자리로 다시 갈 방법도 놓을 방법도 없이
 *    "A를 잡고 있다" 는 문장만 보게 됩니다. 그래서 두 갈래를 함께 줍니다.
 *
 * - **이어서 예매하기** — 쥔 자리 그대로 예매 확인으로 돌아갑니다 (제일 흔한 의도)
 * - **이 자리 놓기** — 자리를 비우고 처음부터 다시 고릅니다
 *
 * 다른 자리를 그냥 골라도 됩니다 — 그때는 `useSeatHold` 가 쥔 자리를 놓고 새로 잡습니다.
 * 여기서 굳이 놓기 버튼을 두는 이유는 **아무 자리도 안 살 사람**에게 길을 주기 위해서입니다.
 * (자리를 붙든 채 나가면 10분 동안 남도 못 삽니다)
 *
 * 놓기는 되돌릴 수 없어(놓는 순간 남이 가져갈 수 있음) 붉은 버튼이고, 확인 모달은
 * 페이지가 띄웁니다 — 모달은 화면 조립의 일이라 View 가 열지 않습니다.
 */
export function HeldSeatNotice({
  hold,
  seatMap,
  remainSeconds,
  onContinue,
  onRelease,
  releasing,
  className,
}: HeldSeatNoticeProps) {
  if (!hold) return null;

  const seat = seatMap?.seats.find((s) => s.id === hold.seatId);
  const section = seatMap?.sections.find((s) => s.id === seat?.sectionId);
  const where = seat ? seatLabel(seat, section?.name ?? '') : '좌석';

  return (
    <div className={cn('surface-2 space-y-3 rounded-2xl p-3.5', className)}>
      <div className="flex items-start gap-2.5">
        <Ticket size={16} className="text-ink-muted mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-ink text-sm font-bold">{where}</p>
          <p className="text-muted mt-0.5 text-xs leading-relaxed">
            이 자리를 잡아두고 있어요. 다른 자리를 고르면 <b>이 자리는 풀립니다.</b>
          </p>
        </div>
        {remainSeconds !== undefined && <HoldTimer remainSeconds={remainSeconds} />}
      </div>

      {(onContinue || onRelease) && (
        <div className="flex gap-2">
          {onRelease && (
            <Button
              variant="danger-ghost"
              size="md"
              className="flex-1"
              loading={releasing}
              onClick={onRelease}
            >
              이 자리 놓기
            </Button>
          )}
          {onContinue && (
            /* 이어가기가 기본 동작입니다 — 결제하러 갔다 온 사람은 대개 그 자리를 살 겁니다 */
            <Button variant="dark" size="md" className="flex-1" onClick={onContinue}>
              이어서 예매하기
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
