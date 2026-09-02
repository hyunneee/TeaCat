import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { bookingApi, bookingKeys } from '../api/bookingApi';

/**
 * 좌석 현황 조회.
 *
 * 티켓팅 오픈 순간에는 좌석 상태가 초 단위로 바뀝니다.
 * 캐시를 믿으면 "선택했는데 이미 팔린 좌석"이 계속 발생합니다.
 * 그래서 staleTime 0 + 3초 폴링.
 *
 * WebSocket 을 붙이면 폴링을 끄고 소켓 이벤트로 queryClient.setQueryData 하세요.
 * 훅의 반환 형태는 그대로라서 화면 코드는 한 줄도 안 바뀝니다.
 */
export function useSeatMap(scheduleId: string, sectionId?: string) {
  return useQuery({
    queryKey: bookingKeys.seatMap(scheduleId, sectionId),
    queryFn: () => bookingApi.seatMap(scheduleId, sectionId),
    staleTime: STALE_TIME.REALTIME,
    refetchInterval: 3000,
    // 백그라운드 탭에서는 폴링 중단 (서버 부하 + 배터리)
    refetchIntervalInBackground: false,
    enabled: !!scheduleId,
  });
}
