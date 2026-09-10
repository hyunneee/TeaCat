import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { tokenKeys } from '@/features/token';
import { ticketApi, ticketKeys } from '../api/ticketApi';

export function useMyTickets() {
  return useQuery({
    queryKey: ticketKeys.list(),
    queryFn: () => ticketApi.list(),
    staleTime: STALE_TIME.SHORT,
  });
}

export function useTicketDetail(ticketId: string) {
  return useQuery({
    queryKey: ticketKeys.detail(ticketId),
    queryFn: () => ticketApi.detail(ticketId),
    staleTime: STALE_TIME.SHORT,
    enabled: !!ticketId,
  });
}

/**
 * 예매 취소.
 *
 * 🔴 인자는 **티켓 ID 가 아니라 주문 ID** 입니다 (`Ticket.orderId`). 화면은
 *    `isCancelable` 로 걸러 orderId 가 있는 티켓에만 버튼을 띄웁니다.
 *
 * 캣머니로 낸 금액은 환급되므로 잔액도 함께 무효화합니다
 * (잔액의 주인은 `tokenKeys.balance()` — CLAUDE.md 3-4).
 */
export function useCancelTicket() {
  return useMutation({
    mutationFn: (orderId: string) => ticketApi.cancel(orderId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ticketKeys.all });
      void queryClient.invalidateQueries({ queryKey: tokenKeys.balance() });
      /* "환불됐다" 가 아니라 "환불이 시작됐다" 입니다. 카드 환불은 카드사 사정으로
         며칠 걸릴 수 있어서, 끝난 것처럼 쓰면 문의가 들어옵니다. */
      toast.success(`취소했어요. ${result.refundAmount.toLocaleString()}원 환불이 진행됩니다.`);
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '취소에 실패했어요.'),
  });
}
