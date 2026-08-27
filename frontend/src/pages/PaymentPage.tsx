import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { CreditCard, Landmark, Receipt, ShieldCheck, Smartphone } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { AnimatedNumber, Button, Card, SectionTitle, Stepper } from '@/shared/components/ui';
import { BOOKING_STEPS, ROUTES } from '@/shared/constants';
import { env } from '@/shared/config';
import { cn, formatPrice } from '@/shared/lib';
import { HoldTimer, seatLabel, useBookingStore, useSeatHold, useSeatMap } from '@/features/booking';
import { usePayment, type PayMethod } from '@/features/payment';

/**
 * 결제수단 목록.
 *
 * 간편결제는 토스에서 별도 수단이 아니라 **카드 통합결제창 안에** 들어 있습니다.
 * (카드를 고르면 토스페이·네이버페이 등이 같은 창에 함께 나옵니다)
 * 수단을 늘리기 전에 계약된 결제수단인지 확인하세요.
 */
const METHODS: { id: PayMethod; label: string; icon: typeof CreditCard }[] = [
  { id: 'CARD', label: '신용/체크카드', icon: CreditCard },
  { id: 'EASY_PAY', label: '간편결제', icon: Smartphone },
  { id: 'TRANSFER', label: '계좌이체', icon: Landmark },
  { id: 'VIRTUAL_ACCOUNT', label: '가상계좌', icon: Receipt },
];

/** 진행 단계별 버튼 문구 — 결제창이 뜬 동안 사용자가 뭘 기다리는지 알려줍니다. */
const STAGE_LABEL = {
  idle: '',
  preparing: '주문 확인 중',
  authenticating: '결제창에서 진행해 주세요',
  confirming: '결제 승인 중',
} as const;

export function PaymentPage() {
  const { scheduleId = '' } = useParams();
  const [payMethod, setPayMethod] = useState<PayMethod>('CARD');

  const hold = useBookingStore((s) => s.hold);
  const sectionId = useBookingStore((s) => s.sectionId);
  const { remainSeconds } = useSeatHold(scheduleId);
  const { data: seatMap } = useSeatMap(scheduleId, sectionId ?? undefined);
  const { pay, stage, isPaying } = usePayment(scheduleId);

  if (!hold) return <Navigate to={ROUTES.BOOKING_SECTION(scheduleId)} replace />;

  const section = seatMap?.sections.find((s) => s.id === sectionId);
  const seats = seatMap?.seats.filter((s) => hold.seatIds.includes(s.id)) ?? [];
  const total = seats.reduce((sum, s) => sum + s.price, 0);
  const fee = 2000 * seats.length;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title="결제" showBack right={<HoldTimer remainSeconds={remainSeconds} />} />
      <Stepper steps={BOOKING_STEPS} current={4} />

      <div className="flex-1 space-y-5 p-4 pt-1">
        {/* 주문 내역 */}
        <section>
          <SectionTitle>예매 내역</SectionTitle>
          <Card className="space-y-2">
            {seats.map((seat) => (
              <div key={seat.id} className="flex items-center justify-between text-sm">
                <span className="text-muted truncate">{seatLabel(seat, section?.name ?? '')}</span>
                <span>{formatPrice(seat.price)}</span>
              </div>
            ))}
          </Card>
        </section>

        {/* 결제수단 */}
        <section>
          <SectionTitle>결제수단</SectionTitle>
          <ul className="space-y-2">
            {METHODS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  disabled={isPaying}
                  onClick={() => setPayMethod(id)}
                  aria-pressed={payMethod === id}
                  className={cn(
                    'surface flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all',
                    'disabled:opacity-50',
                    payMethod === id
                      ? 'border-brand-900 ring-brand-900/15 ring-2'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  <Icon size={19} className="text-muted shrink-0" />
                  <span className="flex-1 text-sm font-medium">{label}</span>
                  <span
                    className={cn(
                      'size-4 shrink-0 rounded-full border-2 transition-colors',
                      payMethod === id ? 'border-brand-900 bg-brand-900' : 'border-line-strong',
                    )}
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* 금액 */}
        <section>
          <SectionTitle>결제 금액</SectionTitle>
          <Card className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">티켓 금액</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">예매 수수료</span>
              <span>{formatPrice(fee)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t pt-2 font-bold">
              <span>총 결제금액</span>
              <AnimatedNumber value={total + fee} format="price" className="text-base" />
            </div>
          </Card>
          <p className="text-subtle mt-1.5 px-1 text-xs">
            최종 결제 금액은 서버가 다시 계산해 확정합니다.
          </p>
        </section>

        <p className="text-subtle flex items-start gap-1.5 text-xs leading-relaxed">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          결제 요청은 멱등키로 보호되어 중복 결제가 발생하지 않습니다. 결제창이 열린 뒤에는
          새로고침하지 말고 창 안에서 진행해 주세요.
        </p>

        {env.payment.mode === 'mock' && (
          <p className="surface-2 border-line text-muted rounded-lg border p-3 text-xs leading-relaxed">
            현재 <b>모의 결제</b> 모드입니다. 실제 결제는 일어나지 않고 확인 창으로 대체됩니다.
            <code>.env</code> 의 <code>VITE_TOSS_CLIENT_KEY</code> 에 토스페이먼츠 클라이언트 키를
            넣으면 실제 테스트 결제창이 뜹니다.
          </p>
        )}

        <BottomBar.Spacer />
      </div>

      <BottomBar>
        <Button
          size="lg"
          fullWidth
          // 중복 결제 방어: 요청 중에는 버튼이 잠깁니다.
          loading={isPaying}
          onClick={() => void pay(payMethod)}
        >
          {isPaying ? STAGE_LABEL[stage] : `${formatPrice(total + fee)} 결제하기`}
        </Button>
      </BottomBar>
    </div>
  );
}
