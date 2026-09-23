import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { useIsLoggedIn } from '@/features/auth';
import { tokenApi, tokenKeys } from '../api/tokenApi';

/**
 * 한 달치 출석 기록.
 *
 * @param month `YYYY-MM`. 없으면 이번 달입니다.
 *
 * 🔴 **오늘이 언제인지·며칠 연속인지는 서버가 정합니다.** 화면에서 `new Date()` 로
 * 오늘을 판단하면 자정 근처에서 도장이 하루 어긋나 보이고(기기 시계가 기준이 됨),
 * 연속 일수는 이 응답이 한 달만 담고 있어서 월초에 지난달에서 이어온 것이 빠집니다.
 */
export function useAttendanceCalendar(month?: string) {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: tokenKeys.attendanceCalendar(month),
    queryFn: () => tokenApi.attendanceCalendar(month),
    enabled: isLoggedIn,
    staleTime: STALE_TIME.SHORT,
  });
}
