import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { ticketApi, ticketKeys } from '../api/ticketApi';
import type { TicketStatus } from '../model/ticket.types';

export function useMyTickets(status?: TicketStatus) {
  return useQuery({
    queryKey: ticketKeys.list(status),
    queryFn: () => ticketApi.list(status),
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
 * 취소된 좌석은 바로 재판매되지 않고 NRF 추첨 대상이 됩니다.
 */
export function useCancelTicket() {
  return useMutation({
    mutationFn: (ticketId: string) => ticketApi.cancel(ticketId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ticketKeys.all });
      toast.success(`취소됐어요. ${result.refundAmount.toLocaleString()}원이 환불됩니다.`);
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '취소에 실패했어요.'),
  });
}
