import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError, queryClient } from '@/shared/api';
import { ROUTES } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { useBookingStore } from '@/features/booking';
import { paymentApi } from '../api/paymentApi';
import { readRedirectResult, requestPayment } from '../api/paymentGateway';
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
 * 모바일에서는 ②가 페이지 이동으로 진행되므로, 돌아왔을 때
 * 쿼리 파라미터를 읽어 ③으로 이어붙입니다.
 */
export function usePayment(scheduleId: string) {
  const navigate = useNavigate();
  const [stage, setStage] = useState<PaymentStage>('idle');

  const hold = useBookingStore((s) => s.hold);
  const recipients = useBookingStore((s) => s.recipients);
  const ensureIdempotencyKey = useBookingStore((s) => s.ensureIdempotencyKey);
  const reset = useBookingStore((s) => s.reset);

  /** 승인 단계. 인증 결과만 있으면 되므로 리디렉션 복귀에서도 재사용합니다. */
  const confirmMutation = useMutation({
    mutationFn: ({ auth, payMethod }: { auth: PaymentAuthResult; payMethod: PayMethod }) =>
      paymentApi.confirm(
        { paymentId: auth.paymentId, txId: auth.txId, payMethod },
        ensureIdempotencyKey(),
      ),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['booking'] });
      void queryClient.invalidateQueries({ queryKey: ['ticket'] });
      // reset() 은 완료 화면에서 합니다. 여기서 비우면 결제 페이지의
      // "선점 없음" 가드가 먼저 발동해 구역 선택으로 튕깁니다.
      navigate(ROUTES.BOOKING_DONE(order.orderId), { replace: true });
    },
    onError: (error) => {
      setStage('idle');
      toast.error(
        ApiError.isApiError(error)
          ? error.message
          : '결제 승인에 실패했습니다. 결제 내역을 확인해 주세요.',
      );
    },
  });

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

        // ② 결제창
        setStage('authenticating');
        const result = await requestPayment({
          prepared,
          payMethod,
          redirectUrl: `${window.location.origin}${ROUTES.BOOKING_PAYMENT(scheduleId)}`,
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
        confirmMutation.mutate({ auth: result.auth, payMethod });
      } catch (error) {
        setStage('idle');
        toast.error(
          ApiError.isApiError(error) ? error.message : '결제를 시작할 수 없습니다.',
        );
      }
    },
    [hold, recipients, scheduleId, confirmMutation],
  );

  /* ── 모바일 리디렉션 복귀 처리 ──────────────────────────────
     결제창에서 돌아오면 주소에 결과가 붙어 있습니다.
     한 번만 처리하고 쿼리를 지워, 새로고침 때 중복 승인되지 않게 합니다. */
  const handledRedirect = useRef(false);

  useEffect(() => {
    if (handledRedirect.current) return;
    const result = readRedirectResult(window.location.search);
    if (!result) return;

    handledRedirect.current = true;
    window.history.replaceState({}, '', window.location.pathname);

    if (!result.ok) {
      if (!result.failure.canceledByUser) toast.error(result.failure.message);
      return;
    }

    setStage('confirming');
    // 리디렉션 복귀 시점에는 어떤 수단으로 결제했는지 알 수 없어 CARD 로 둡니다.
    // (백엔드가 포트원 조회로 실제 수단을 알 수 있으므로 참고값입니다)
    confirmMutation.mutate({ auth: result.auth, payMethod: 'CARD' });
    // confirmMutation 은 매 렌더 새로 만들어지므로 의존성에서 제외합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = stage !== 'idle';

  return {
    pay,
    stage,
    /** 결제 진행 중 — 버튼을 잠가 중복 요청을 막으세요 */
    isPaying: busy,
    reset,
  };
}
