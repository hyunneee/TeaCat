import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { useCountdown } from '@/shared/hooks';
import { useAuth } from '@/features/auth';
import { bookingApi, bookingKeys } from '../api/bookingApi';
import type { MyHold } from '../model/booking.types';

/**
 * 내가 선점 중인 좌석 (`GET /me/holds`).
 *
 * 서버가 조회 직전에 만료된 선점을 정리하고 주므로 **유효한 것만** 옵니다.
 * 1인 1매는 회차 단위 제약이라 회차가 다르면 여러 건이 오고, 만료가 임박한 순입니다.
 *
 * 🔴 선점은 예매 스토어에도 있지만 **원본은 서버**입니다. 스토어는 sessionStorage 라
 *    탭을 닫으면 사라지고, 봇 확인을 다시 통과하면 일부러 비웁니다. 그동안에도
 *    서버 선점은 살아 있으므로, 화면은 이 쿼리를 기준으로 되살립니다.
 */
export function useMyHolds() {
  const { isLoggedIn } = useAuth();

  return useQuery({
    queryKey: bookingKeys.myHolds(),
    queryFn: () => bookingApi.myHolds(),
    enabled: isLoggedIn,
    staleTime: STALE_TIME.REALTIME,
  });
}

/**
 * 지금 이어서 결제할 선점 하나와 남은 시간.
 *
 * 남은 초는 **응답을 받은 시각**을 기준으로 다시 잽니다. 서버가 준 `remainingSeconds`
 * 를 그대로 화면에 걸면 캐시된 응답에서 시간이 되감긴 것처럼 보입니다.
 * (`expiresAt` 을 클라이언트 시계로 계산하지 않는 이유는 `booking.types` 참고)
 */
export function useActiveHold(): { hold: MyHold | null; remainSeconds: number } {
  const { data, dataUpdatedAt } = useMyHolds();

  // 서버가 만료 임박 순으로 주므로 맨 앞이 가장 급한 선점입니다
  const next = data?.[0] ?? null;
  const remainSeconds = useCountdown(next ? dataUpdatedAt + next.remainingSeconds * 1000 : null);

  return { hold: remainSeconds > 0 ? next : null, remainSeconds };
}
