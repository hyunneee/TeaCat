import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { bookingApi, bookingKeys } from '../api/bookingApi';

/**
 * 예매 정책 (1인 최대 매수 등).
 *
 * 회차가 아니라 **공연 단위**입니다. 회차 화면에서 쓰려면
 * `useSchedule(scheduleId).data.concertId` 를 먼저 얻어야 합니다.
 *
 * 자주 바뀌지 않으므로 길게 캐시합니다.
 */
export function useBookingPolicy(concertId: string | undefined) {
  return useQuery({
    queryKey: bookingKeys.policy(concertId ?? ''),
    queryFn: () => bookingApi.policy(concertId as string),
    staleTime: STALE_TIME.LONG,
    enabled: !!concertId,
  });
}
