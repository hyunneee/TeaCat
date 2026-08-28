import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Grape, ShieldCheck, Smartphone } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { AnimatedNumber, Button, Card, SectionTitle, Stepper } from '@/shared/components/ui';
import { BOOKING_STEPS, ROUTES, toPoints } from '@/shared/constants';
import { env } from '@/shared/config';
import { cn, formatPrice } from '@/shared/lib';
import { HoldTimer, seatLabel, useBookingStore, useSeatHold, useSeatMap } from '@/features/booking';
import { useTokenBalance } from '@/features/nft';
import { TossPaymentSheet, usePayment, type PayMethod } from '@/features/payment';

/**
 * 결제수단 — 지금은 둘뿐입니다.
 *
 *   간편결제 — 토스 통합결제창. 카드·토스페이·네이버페이가 한 창에 나옵니다.
 *   포도알   — 앱 안의 포인트. 결제창 없이 서버가 잔액을 차감합니다.
 *
 * 수단을 늘리기 전에 계약된 결제수단인지 확인하세요.
 */
const METHODS: { id: PayMethod; label: string; hint: string; icon: typeof Grape }[] = [
  { id: 'EASY_PAY', label: '간편결제 (토스)', hint: '카드 · 토스페이 · 네이버페이', icon: Smartphone },
  { id: 'POINT', label: '포도알로 결제', hint: '결제창 없이 바로 차감', icon: Grape },
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
  const [payMethod, setPayMethod] = useState<PayMethod>('EASY_PAY');
  const [sheetOpen, setSheetOpen] = useState(false);

  const hold = useBookingStore((s) => s.hold);
  const sectionId = useBookingStore((s) => s.sectionId);
  const { remainSeconds } = useSeatHold(scheduleId);
  const { data: seatMap } = useSeatMap(scheduleId, sectionId ?? undefined);
  const { pay, stage, isPaying } = usePayment(scheduleId);
  const { data: token } = useTokenBalance();

  const section = seatMap?.sections.find((s) => s.id === sectionId);
  const heldSeatIds = hold?.seatIds ?? [];
  const seats = seatMap?.seats.filter((s) => heldSeatIds.includes(s.id)) ?? [];
  const total = seats.reduce((sum, s) => sum + s.price, 0);
  const fee = 2000 * seats.length;

  /* 포도알 표시용 어림값입니다. 실제 차감량은 서버가 다시 계산합니다.
     (프론트가 계산한 숫자를 그대로 결제에 쓰면 공짜 티켓이 나옵니다) */
  const pointsNeeded = toPoints(total + fee);
  const pointBalance = token?.balance ?? 0;
  const shortOfPoints = payMethod === 'POINT' && pointBalance < pointsNeeded;

  /* 위젯 키(test_gck_)면 결제수단 UI 가 페이지에 삽입되므로 시트에 담아 띄웁니다.
     개별 연동 키(test_ck_)면 토스가 새 창을 띄우니 시트가 필요 없습니다. */
  const usesSheet = env.payment.mode === 'toss' && env.payment.widgetKey;
  const needsSheet = payMethod === 'EASY_PAY' && usesSheet;

  // 선점이 없으면 결제할 게 없습니다. (만료·직접 진입)
  if (!hold) return <Navigate to={ROUTES.BOOKING_SECTION(scheduleId)} replace />;

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
            {METHODS.map(({ id, label, hint, icon: Icon }) => (
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
                  <Icon size={19} className="text-muted mt-0.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="text-subtle block text-xs">
                      {id === 'POINT'
                        ? `보유 ${pointBalance.toLocaleString()}개 · 필요 ${pointsNeeded.toLocaleString()}개`
                        : hint}
                    </span>
                  </span>
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
            {payMethod === 'POINT'
              ? `포도알 ${pointsNeeded.toLocaleString()}개가 차감됩니다. 최종 차감량은 서버가 확정합니다.`
              : '최종 결제 금액은 서버가 다시 계산해 확정합니다.'}
          </p>
        </section>

        <p className="text-subtle flex items-start gap-1.5 text-xs leading-relaxed">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          결제 요청은 멱등키로 보호되어 중복 결제가 발생하지 않습니다. 결제창이 열린 뒤에는
          새로고침하지 말고 창 안에서 진행해 주세요.
        </p>

        {env.payment.mode === 'mock' && payMethod !== 'POINT' && (
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
          disabled={shortOfPoints}
          onClick={() => (needsSheet ? setSheetOpen(true) : void pay(payMethod))}
        >
          {isPaying
            ? STAGE_LABEL[stage]
            : shortOfPoints
              ? '포도알이 부족해요'
              : payMethod === 'POINT'
                ? `포도알 ${pointsNeeded.toLocaleString()}개로 결제`
                : `${formatPrice(total + fee)} 결제하기`}
        </Button>
      </BottomBar>

      {/* 토스 결제위젯 — 결제할 때만 화면을 덮습니다 */}
      <TossPaymentSheet
        open={sheetOpen}
        amount={total + fee}
        paying={isPaying}
        stageLabel={STAGE_LABEL[stage]}
        onClose={() => setSheetOpen(false)}
        onConfirm={() => void pay('EASY_PAY')}
      />
    </div>
  );
}
