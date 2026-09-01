import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Info, UserRound } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { Badge, Button, Card, Stepper } from '@/shared/components/ui';
import { BOOKING_STEPS, ROUTES } from '@/shared/constants';
import { formatPrice } from '@/shared/lib';
import {
  HoldTimer,
  seatLabel,
  useBookingStore,
  useRecipients,
  useSeatHold,
  useSeatMap,
} from '@/features/booking';

/**
 * 예매 확인 — 좌석별 티켓 수령인을 확정하는 단계.
 *
 * 이 서비스는 예매 후 단순 양도를 막습니다. 대신 **결제 전에** 누가 이 티켓을 쓸지
 * 지정하게 합니다. 기본값은 본인이고, 일행 좌석만 아이디를 바꾸면 됩니다.
 */
export function BookingReviewPage() {
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams();

  const hold = useBookingStore((s) => s.hold);
  const sectionId = useBookingStore((s) => s.sectionId);
  const { remainSeconds } = useSeatHold(scheduleId);
  const { data: seatMap } = useSeatMap(scheduleId, sectionId ?? undefined);

  const seatIds = hold?.seatIds ?? [];
  const recipients = useRecipients(seatIds);

  if (!hold) return <Navigate to={ROUTES.BOOKING_SECTION(scheduleId)} replace />;

  const section = seatMap?.sections.find((s) => s.id === sectionId);
  const seats = seatMap?.seats.filter((s) => seatIds.includes(s.id)) ?? [];
  const total = seats.reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header
        title="예매 확인"
        showBack
        right={<HoldTimer remainSeconds={remainSeconds} />}
      />
      <Stepper steps={BOOKING_STEPS} current={3} />

      <div className="flex-1 space-y-4 p-4 pt-1">
        <Card flat className="flex gap-3">
          <Info size={19} className="text-ink-muted shrink-0" />
          <p className="text-muted text-xs leading-relaxed">
            티켓은 <b className="text-ink">예매한 본인에게만</b> 발급되며, 발급 후에는 양도할 수
            없습니다. 입장 시 등록된 얼굴로 본인 확인을 합니다.
          </p>
        </Card>

        <ul className="space-y-2">
          {seats.map((seat) => (
            <li key={seat.id}>
              <Card flat className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{seatLabel(seat, section?.name ?? '')}</p>
                  <p className="text-muted text-sm">{formatPrice(seat.price)}</p>
                </div>

                {/* 수령인은 **고칠 수 없습니다.** 입력창으로 열어 두면
                    남의 아이디를 넣어 넘기는 길이 생기고, 그게 곧 암표입니다.
                    입력창처럼 보이면 사람들이 고치려 들다가 막혀서 더 답답해합니다 —
                    아예 읽는 줄로 보여줍니다. */}
                <div className="space-y-1.5">
                  <p className="text-ink-muted text-sm font-medium">티켓 받을 사람</p>
                  <div className="surface-2 flex h-12 items-center gap-2.5 rounded-xl px-3.5">
                    <UserRound size={16} className="text-subtle shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">
                      {recipients.valueOf(seat.id)}
                    </span>
                    <Badge tone="neutral">본인</Badge>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>

        <BottomBar.Spacer className="h-[calc(7.5rem+env(safe-area-inset-bottom))]" />
      </div>

      <BottomBar className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">총 {seats.length}매</span>
          <span className="text-lg font-extrabold">{formatPrice(total)}</span>
        </div>
        <Button
          variant="dark"
          size="lg"
          fullWidth
          disabled={!recipients.filled}
          onClick={() => navigate(ROUTES.BOOKING_PAYMENT(scheduleId))}
        >
          결제하기
        </Button>
      </BottomBar>
    </div>
  );
}
