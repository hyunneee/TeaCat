import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Info, UserRound } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { Button, Card, Input, Stepper } from '@/shared/components/ui';
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
            티켓은 <b className="text-ink">여기서 지정한 아이디의 사용자</b>에게 발급되며,
            발급 후에는 양도할 수 없습니다. 입장 시 등록된 얼굴로 본인 확인을 합니다.
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

                <Input
                  label="티켓 받을 사람 (아이디)"
                  value={recipients.valueOf(seat.id)}
                  onChange={(e) => recipients.setRecipient(seat.id, e.target.value)}
                  leftIcon={<UserRound size={16} />}
                  placeholder="아이디를 입력하세요"
                  hint={
                    recipients.valueOf(seat.id) === recipients.myLoginId
                      ? '내가 사용할 티켓입니다.'
                      : '지정한 사용자에게 발급됩니다.'
                  }
                />
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
