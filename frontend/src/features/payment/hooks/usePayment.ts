import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError, queryClient } from '@/shared/api';
import { ROUTES } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { useBookingStore } from '@/features/booking';
import { paymentApi } from '../api/paymentApi';
import { requestPayment } from '../api/paymentGateway';
import type { PayMethod, PaymentAuthResult } from '../model/payment.types';

/** 사용자에게 보여줄 진행 단계 */
export type PaymentStage =
  | 'idle'
  /** 서버에서 주문·금액 확정 중 */
  | 'preparing'
  /** 결제창이 떠 있는 중 */
  | 'authenticating'
  /** 백엔드가 승인·검증 중 */
  | 'confirming';

/**
 * 결제 승인(검증) 요청.
 *
 * 결제창 인증 결과만 있으면 되므로, 결제 페이지와 리디렉션 복귀 화면이
 * 같은 훅을 씁니다. 멱등키를 붙여 두 경로에서 중복 승인되지 않게 합니다.
 */
export function useConfirmPayment() {
  const navigate = useNavigate();
  const ensureIdempotencyKey = useBookingStore((s) => s.ensureIdempotencyKey);

  return useMutation({
    mutationFn: ({ auth, payMethod }: { auth: PaymentAuthResult; payMethod: PayMethod }) =>
      paymentApi.confirm(
        {
          paymentId: auth.paymentId,
          paymentKey: auth.paymentKey,
          // 서버는 이 금액을 믿지 않고 자기가 저장한 값과 비교합니다.
          amount: auth.amount,
          payMethod,
        },
        ensureIdempotencyKey(),
      ),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['booking'] });
      void queryClient.invalidateQueries({ queryKey: ['ticket'] });
      // 플로우 상태 정리는 완료 화면에서 합니다. 여기서 비우면 결제 페이지의
      // "선점 없음" 가드가 먼저 발동해 구역 선택으로 튕깁니다.
      navigate(ROUTES.BOOKING_DONE(order.orderId), { replace: true });
    },
  });
}

/**
 * 결제 플로우 전체.
 *
 *   ① prepare   서버가 주문 생성 + 금액/paymentId 확정
 *   ② 결제창     포트원 결제창에서 사용자 인증 (카드 입력·간편결제 등)
 *   ③ confirm   백엔드가 포트원 조회 → 금액 검증 → 승인 → 티켓 발급
 *
 * ②까지가 프론트 몫이고 ③은 백엔드가 실제로 일합니다.
 * 백엔드가 준비되면 `paymentApi.confirm` 의 응답만 맞춰주면
 * 이 훅과 화면은 그대로 씁니다.
 *
 * 토스페이먼츠는 인증에 성공하면 `successUrl` 로 페이지를 이동시킵니다.
 * 즉 **성공 결과는 항상 리디렉션으로** 돌아오고, `BOOKING_PAYMENT_RESULT`
 * 라우트에서 ③을 이어붙입니다. (usePaymentResult)
 */
export function usePayment(scheduleId: string) {
  const [stage, setStage] = useState<PaymentStage>('idle');

  const hold = useBookingStore((s) => s.hold);
  const recipients = useBookingStore((s) => s.recipients);
  const confirm = useConfirmPayment();

  const pay = useCallback(
    async (payMethod: PayMethod) => {
      if (!hold) {
        toast.error('좌석 선점이 만료되었습니다. 다시 선택해 주세요.');
        return;
      }

      try {
        // ① 금액·주문번호는 서버가 정합니다.
        setStage('preparing');
        const prepared = await paymentApi.prepare({
          holdId: hold.holdId,
          recipients: recipients.filter((r) => hold.seatIds.includes(r.seatId)),
        });

        /* ② 결제창.
              토스페이먼츠는 성공하면 successUrl 로 **페이지가 이동**합니다.
              그래서 성공 경로는 여기로 돌아오지 않고 result 라우트에서 이어집니다. */
        setStage('authenticating');
        const resultUrl = `${window.location.origin}${ROUTES.BOOKING_PAYMENT_RESULT(scheduleId)}`;
        const result = await requestPayment({
          prepared,
          payMethod,
          successUrl: resultUrl,
          failUrl: resultUrl,
        });

        if (!result.ok) {
          setStage('idle');
          // 사용자가 창을 닫은 것뿐이면 조용히 되돌립니다.
          if (result.failure.canceledByUser) return;
          if (result.failure.code === 'REDIRECTED') return;
          toast.error(result.failure.message);
          return;
        }

        // ③ 승인은 백엔드가
        setStage('confirming');
        confirm.mutate(
          { auth: result.auth, payMethod },
          {
            onError: (error) => {
              setStage('idle');
              toast.error(
                ApiError.isApiError(error)
                  ? error.message
                  : '결제 승인에 실패했습니다. 결제 내역을 확인해 주세요.',
              );
            },
          },
        );
      } catch (error) {
        setStage('idle');
        toast.error(ApiError.isApiError(error) ? error.message : '결제를 시작할 수 없습니다.');
      }
    },
    [hold, recipients, scheduleId, confirm],
  );

  return {
    pay,
    stage,
    /** 결제 진행 중 — 버튼을 잠가 중복 요청을 막으세요 */
    isPaying: stage !== 'idle',
  };
}
