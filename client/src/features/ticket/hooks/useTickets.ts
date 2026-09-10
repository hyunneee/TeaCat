import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { ticketApi, ticketKeys } from '../api/ticketApi';

export function useMyTickets() {
  return useQuery({
    queryKey: ticketKeys.list(),
    queryFn: () => ticketApi.list(),
    staleTime: STALE_TIME.SHORT,
  });
}

/**
 * 티켓 한 장.
 *
 * NFT 발행은 결제 뒤에 뒤따라가므로(체인 확정 ~10초) 결제 직후에 열면
 * `nftStatus` 가 `PENDING` 일 수 있습니다. 예매 자체는 그때도 유효합니다.
 */
export function useTicketDetail(ticketId: string) {
  return useQuery({
    queryKey: ticketKeys.detail(ticketId),
    queryFn: () => ticketApi.detail(ticketId),
    staleTime: STALE_TIME.SHORT,
    enabled: !!ticketId,
  });
}
