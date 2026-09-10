import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { paymentApi, paymentKeys } from '../api/paymentApi';

/**
 * 주문 한 건 (`GET /payments/ticket-orders/{id}`).
 *
 * 티켓 화면이 **결제 금액**을 보여줄 때 씁니다. 서버의 티켓 응답에는 금액이 없습니다 —
 * 금액은 주문에 속한 정보이고, 티켓은 "무엇을 보러 가는가" 만 답합니다.
 */
export function useTicketOrder(ticketOrderId: number | null) {
  return useQuery({
    queryKey: paymentKeys.order(ticketOrderId ?? 0),
    queryFn: () => paymentApi.order(ticketOrderId as number),
    enabled: ticketOrderId !== null,
    staleTime: STALE_TIME.SHORT,
  });
}

/**
 * 예매 취소.
 *
 * 🔴 취소는 **주문**에 걸려 있습니다(티켓이 아니라). 카드 취소·캣머니 환급·NFT 소각이
 *    한 주문에 묶여 있어서입니다. 티켓 화면은 `ticket.orderId` 로 이 훅을 부릅니다.
 *
 * 서버는 예매를 먼저 무효화하고 좌석을 풀어 준 뒤 환불을 보냅니다. 환불이 실패해도
 * 취소는 유효하고 서버 배치가 끝까지 따라가므로, 화면은 "취소됨" 으로 넘어갑니다.
 */
export function useCancelOrder() {
  return useMutation({
    mutationFn: (ticketOrderId: number) => paymentApi.cancel(ticketOrderId),
    onSuccess: (order) => {
      // 티켓 상태 · 좌석 현황 · 캣머니 잔액이 함께 바뀝니다
      void queryClient.invalidateQueries({ queryKey: ['ticket'] });
      void queryClient.invalidateQueries({ queryKey: ['booking'] });
      void queryClient.invalidateQueries({ queryKey: ['token'] });
      void queryClient.invalidateQueries({ queryKey: paymentKeys.order(order.ticketOrderId) });
      toast.success('예매가 취소됐어요. 환불은 결제하신 수단으로 돌아갑니다.');
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '예매 취소에 실패했어요.'),
  });
}
