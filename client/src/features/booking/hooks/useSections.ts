import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { bookingApi, bookingKeys } from '../api/bookingApi';

/**
 * 구역 목록 (플로우: 봇 확인 → 구역 → 좌석 선택).
 *
 * 좌석 수천 개를 한 번에 내려받지 않고 구역을 먼저 고르게 하는 이유:
 * 오픈 순간 전 좌석 조회가 몰리면 서버도 클라이언트도 버티지 못합니다.
 */
export function useSections(scheduleId: string) {
  return useQuery({
    queryKey: bookingKeys.sections(scheduleId),
    queryFn: () => bookingApi.sections(scheduleId),
    staleTime: STALE_TIME.REALTIME,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    enabled: !!scheduleId,
  });
}
