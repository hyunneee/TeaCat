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
import { usesGateway } from '../model/payment.model';

export type PaymentStage = 'idle' | 'preparing' | 'authenticating' | 'confirming';

/** 결제 승인 후 공통 후처리와 완료 화면 이동을 담당합니다. */
export function useConfirmPayment() {
  const navigate = useNavigate();
  const ensureIdempotencyKey = useBookingStore((s) => s.ensureIdempotencyKey);

  return useMutation({
    mutationFn: ({ auth }: { auth: PaymentAuthResult }) =>
      paymentApi.confirm(
        {
          ticketOrderId: auth.ticketOrderId,
          ...(auth.paymentKey ? { paymentKey: auth.paymentKey, amount: auth.amount } : {}),
        },
        ensureIdempotencyKey(),
      ),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['booking'] });
      void queryClient.invalidateQueries({ queryKey: ['ticket'] });
      void queryClient.invalidateQueries({ queryKey: ['token'] });
      navigate(ROUTES.BOOKING_DONE(String(order.ticketOrderId)), { replace: true });
    },
  });
}

/** 실제 서버 주문 생성부터 캣머니/토스 승인까지 이어주는 결제 흐름입니다. */
export function usePayment(scheduleId: string) {
  const [stage, setStage] = useState<PaymentStage>('idle');
  const hold = useBookingStore((s) => s.hold);
  const confirm = useConfirmPayment();

  const pay = useCallback(
    async (payMethod: PayMethod) => {
      if (!hold) {
        toast.error('좌석 선점이 만료되었습니다. 다시 선택해 주세요.');
        return;
      }

      const performanceDetailId = Number(hold.scheduleId);
      const seatId = Number(hold.seatId);
      if (!Number.isSafeInteger(performanceDetailId) || !Number.isSafeInteger(seatId)) {
        toast.error('결제할 회차 또는 좌석 정보가 올바르지 않습니다.');
        return;
      }

      try {
        setStage('preparing');
        const prepared = await paymentApi.prepare({ performanceDetailId, seatId });

        // 서버가 카드 결제액을 0원으로 확정하면 토스를 거치지 않고 바로 발권합니다.
        if (prepared.cashAmount === 0) {
          setStage('confirming');
          confirm.mutate(
            {
              auth: { ticketOrderId: prepared.ticketOrderId, paymentKey: '', amount: 0 },
            },
            {
              onError: (error) => {
                setStage('idle');
                toast.error(
                  ApiError.isApiError(error) ? error.message : '캣머니 결제에 실패했습니다.',
                );
              },
            },
          );
          return;
        }

        // POINT를 골랐는데 서버 가용 잔액이 부족하면 임의로 카드 결제로 바꾸지 않습니다.
        if (!usesGateway(payMethod)) {
          setStage('idle');
          // 베타: 간편결제를 막아 둬서 부족분을 메울 방법이 없습니다. 문구만 바꿉니다.
          //   원래 — '캣머니가 부족합니다. 간편결제로 부족한 금액을 결제해 주세요.'
          toast.error('캣머니가 부족합니다. 잔액을 확인해 주세요.');
          return;
        }

        setStage('authenticating');
        const resultUrl = new URL(
          ROUTES.BOOKING_PAYMENT_RESULT(scheduleId),
          window.location.origin,
        );
        // 토스는 orderId만 돌려주므로 서버 PK를 리디렉션 URL에 보존합니다.
        resultUrl.searchParams.set('ticketOrderId', String(prepared.ticketOrderId));

        const result = await requestPayment({
          prepared,
          successUrl: resultUrl.toString(),
          failUrl: resultUrl.toString(),
        });

        if (!result.ok) {
          setStage('idle');
          if (result.failure.canceledByUser || result.failure.code === 'REDIRECTED') return;
          toast.error(result.failure.message);
          return;
        }

        // 모의 PG 모드처럼 리디렉션 없이 인증 결과가 돌아오는 경우입니다.
        setStage('confirming');
        confirm.mutate(
          { auth: result.auth },
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
    [hold, scheduleId, confirm],
  );

  return { pay, stage, isPaying: stage !== 'idle' };
}
