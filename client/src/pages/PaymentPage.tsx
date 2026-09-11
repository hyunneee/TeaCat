import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
// 베타: Smartphone 은 간편결제 수단의 아이콘입니다 (①)
import { Coins, ShieldCheck } from 'lucide-react';
import { PageLoader } from '@/shared/components/common';
import { BottomBar, Header } from '@/shared/components/layout';
import { AnimatedNumber, Button, Card, SectionTitle, Stepper } from '@/shared/components/ui';
import { BOOKING_STEPS, ROUTES } from '@/shared/constants';
// 베타: env.payment 는 토스 위젯 판단에만 쓰였습니다 (③)
// import { env } from '@/shared/config';
import { cn, formatPoints, formatPrice } from '@/shared/lib';
import {
  HoldTimer,
  priceLabel,
  seatLabel,
  useBookingStore,
  useResumeHold,
  useSeatHold,
  useSeatMap,
} from '@/features/booking';
import { useTokenBalance } from '@/features/token';
// 베타: TossPaymentSheet 는 ④ 에서 다시 켭니다
import { usePayment, type PayMethod } from '@/features/payment';

/**
 * 결제수단 — 지금은 둘뿐입니다.
 *
 *   간편결제 — 캣머니를 먼저 사용하고 부족분만 토스 결제창에서 결제합니다.
 *   캣머니   — 앱 안의 포인트. 결제창 없이 서버가 잔액을 차감합니다.
 *
 * 수단을 늘리기 전에 계약된 결제수단인지 확인하세요.
 */
/* 🔴 베타 기간에는 토스페이먼츠 결제를 막아 두었습니다 — 캣머니 전용입니다.
 *
 * 되돌리려면 이 파일에서 ① ② ③ ④ 로 표시한 네 곳의 주석만 풀면 됩니다
 * (맨 위 import 세 줄 포함). 서버·토스 키·결과 처리 화면은 그대로 두었으므로
 * 프론트만 되돌리면 즉시 복구됩니다.
 */
const METHODS: { id: PayMethod; label: string; hint: string; icon: typeof Coins }[] = [
  // ① 베타: 간편결제(토스) 수단을 감춥니다
  // {
  //   id: 'EASY_PAY',
  //   label: '캣머니 + 간편결제',
  //   hint: '캣머니 우선 사용 · 부족분만 결제',
  //   icon: Smartphone,
  // },
  { id: 'POINT', label: '캣머니로 결제', hint: '결제창 없이 바로 차감', icon: Coins },
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
  // ② 베타: 캣머니 전용이라 POINT 로 시작합니다 (원래 'EASY_PAY')
  const [payMethod, setPayMethod] = useState<PayMethod>('POINT');
  // const [sheetOpen, setSheetOpen] = useState(false);

  const hold = useBookingStore((s) => s.hold);
  const { remainSeconds } = useSeatHold(scheduleId);
  const { isResuming } = useResumeHold(scheduleId);
  const { data: seatMap } = useSeatMap(scheduleId);
  const { pay, stage, isPaying } = usePayment(scheduleId);
  const { data: token } = useTokenBalance();

  const heldSeatIds = hold ? [hold.seatId] : [];
  const seats = seatMap?.seats.filter((s) => heldSeatIds.includes(s.id)) ?? [];
  /* 구역은 **잡은 좌석**에서 찾습니다 (BookingReviewPage 주석 참고) */
  const section = seatMap?.sections.find((s) => s.id === seats[0]?.sectionId);
  const total = seats.reduce((sum, s) => sum + (s.price ?? 0), 0);

  /* 서버 결제 정책은 1캣머니를 결제 금액 1원과 같은 단위로 계산합니다.
     실제 사용액은 주문 준비 응답의 tokenAmount가 최종 기준입니다. */
  const pointsNeeded = total;
  /* 경매 입찰로 묶인 돈은 결제에 쓸 수 없습니다 — 보여주는 것도 판단하는 것도 available 입니다 */
  const pointBalance = token?.available ?? 0;
  const payingWithPoints = payMethod === 'POINT';
  const shortOfPoints = payingWithPoints && pointBalance < pointsNeeded;
  // ③ 베타: 결제창을 띄우지 않으므로 카드 결제액을 계산하지 않습니다
  // const estimatedCashAmount = Math.max(total - pointBalance, 0);

  /* 위젯 키(test_gck_)면 결제수단 UI 가 페이지에 삽입되므로 시트에 담아 띄웁니다.
     개별 연동 키(test_ck_)면 토스가 새 창을 띄우니 시트가 필요 없습니다. */
  // const usesSheet = env.payment.mode === 'toss' && env.payment.widgetKey;
  // const needsSheet = payMethod === 'EASY_PAY' && usesSheet && estimatedCashAmount > 0;

  // 선점이 없으면 결제할 게 없습니다. (만료·직접 진입)
  // 단, 서버에 남은 선점을 확인하는 중이면 기다립니다 — 결제 직전에 튕기는 게 제일 아깝습니다
  if (!hold) {
    return isResuming ? <PageLoader /> : <Navigate to={ROUTES.BOOKING_SECTION(scheduleId)} replace />;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title="결제" showBack right={<HoldTimer remainSeconds={remainSeconds} />} />
      <Stepper steps={BOOKING_STEPS} current={4} />

      <div className="flex-1 space-y-4 p-4 pt-1">
        {/* 주문 내역 */}
        <section>
          <SectionTitle>예매 내역</SectionTitle>
          <Card flat className="space-y-2">
            {seats.map((seat) => (
              <div key={seat.id} className="flex items-center justify-between text-sm">
                <span className="text-muted truncate">{seatLabel(seat, section?.name ?? '')}</span>
                <span>{priceLabel(seat.price)}</span>
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
                    'surface shadow-card flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all',
                    'disabled:opacity-50',
                    /* 고른 수단은 **테두리 색**으로만 표시합니다. 두께를 항상 2px 로 두면
                       고를 때마다 칸 크기가 흔들리지 않습니다. */
                    payMethod === id
                      ? 'border-brand-900'
                      : 'border-transparent hover:border-line',
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
          {/* 캣머니로 낼 거면 **줄마다 캣머니**로 보여줍니다.
              위는 원, 맨 아래만 캣머니면 "그래서 얼마가 나가는 건데?" 를 암산하게 됩니다.
              (환산은 표시용 어림값입니다 — 차감량은 서버가 확정합니다) */}
          <Card flat className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">티켓 금액</span>
              <span>{payingWithPoints ? formatPoints(pointsNeeded) : formatPrice(total)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t pt-2 font-bold">
              <span>총 결제금액</span>
              {payingWithPoints ? (
                <span className="text-base">
                  <AnimatedNumber value={pointsNeeded} className="tabular-nums" />
                  <span className="ml-1">캣머니</span>
                </span>
              ) : (
                <AnimatedNumber value={total} format="price" className="text-base" />
              )}
            </div>
          </Card>
          <p className="text-subtle mt-1.5 px-1 text-xs">
            {payingWithPoints
              ? `보유 ${pointBalance.toLocaleString()}캣머니에서 차감됩니다.`
              : '결제 직전에 금액을 한 번 더 확인해 드려요.'}
          </p>
        </section>

        <p className="text-subtle flex items-start gap-1.5 text-xs leading-relaxed">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          같은 결제가 두 번 처리되지 않도록 보호됩니다. 결제가 시작된 뒤에는 새로고침하지 말고
          화면 안에서 진행해 주세요.
        </p>

        <BottomBar.Spacer />
      </div>

      <BottomBar>
        <Button
          variant="dark"
          size="lg"
          fullWidth
          // 중복 결제 방어: 요청 중에는 버튼이 잠깁니다.
          loading={isPaying}
          disabled={shortOfPoints}
          // ④ 베타: 시트를 거치지 않고 바로 캣머니로 결제합니다
          //   원래 — onClick={() => (needsSheet ? setSheetOpen(true) : void pay(payMethod))}
          onClick={() => void pay(payMethod)}
        >
          {isPaying
            ? STAGE_LABEL[stage]
            : shortOfPoints
              ? '캣머니가 부족해요'
              : payingWithPoints
                ? `${formatPoints(pointsNeeded)}로 결제`
                : `${formatPrice(total)} 결제하기`}
        </Button>
      </BottomBar>

      {/* ④ 베타: 토스 결제위젯 — 결제할 때만 화면을 덮습니다 */}
      {/* <TossPaymentSheet
        open={sheetOpen}
        amount={estimatedCashAmount}
        paying={isPaying}
        stageLabel={STAGE_LABEL[stage]}
        onClose={() => setSheetOpen(false)}
        onConfirm={() => void pay('EASY_PAY')}
      /> */}
    </div>
  );
}
