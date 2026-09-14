import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
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
 * 잡아둔 자리를 **직접 놓습니다** (홈의 안내 카드).
 *
 * 🔴 그냥 두면 10분이 지나야 풀립니다. 그동안 그 자리는 남도 못 사고, 1인 1매라
 * 본인도 그 회차의 다른 자리를 잡을 수 없습니다. 마음이 바뀌었을 때 기다리지 않고
 * 빠져나올 길을 둡니다.
 */
export function useReleaseMyHold() {
  return useMutation({
    mutationFn: ({ scheduleId, seatId }: { scheduleId: string; seatId: string }) =>
      bookingApi.releaseHold(scheduleId, seatId),
    /* 이미 만료돼 사라진 선점을 다시 놓으려 하면 404 입니다. 재시도는 의미가 없습니다 */
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.myHolds() });
      toast.success('잡아둔 자리를 놓았어요.');
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.myHolds() });
      toast.error(ApiError.isApiError(error) ? error.message : '자리를 놓지 못했어요.');
    },
  });
}

/** 선점 하나 + 지금 남은 초 */
export interface ActiveHold {
  hold: MyHold;
  remainSeconds: number;
}

/**
 * 아직 살아 있는 선점 **전부**와 각자의 남은 시간.
 *
 * 🔴 예전에는 맨 앞 하나만 돌려줬습니다(`useActiveHold`). 공연 두 개에서 자리를 잡아두면
 *    홈에 하나만 떠서, 나머지 자리는 **돌아갈 길이 없이 10분간 묶여 있었습니다.**
 *    1인 1매는 회차 단위 제약이라 회차가 다르면 여러 건이 정상입니다.
 *
 * 남은 초는 **응답을 받은 시각**을 기준으로 다시 잽니다. 서버가 준 `remainingSeconds`
 * 를 그대로 화면에 걸면 캐시된 응답에서 시간이 되감긴 것처럼 보입니다.
 * (`expiresAt` 을 클라이언트 시계로 계산하지 않는 이유는 `booking.types` 참고)
 *
 * 시계는 **하나만** 돌립니다 — 선점마다 타이머를 붙이면 초가 서로 어긋나 보입니다.
 * 가장 늦게 끝나는 선점까지 1초마다 리렌더하고, 남은 초는 렌더할 때 다시 계산합니다
 * (백그라운드 탭에서 밀리지 않게 — `useCountdown` 과 같은 방식).
 */
export function useActiveHolds(): ActiveHold[] {
  const { data, dataUpdatedAt } = useMyHolds();

  const deadlineOf = (hold: MyHold) => dataUpdatedAt + hold.remainingSeconds * 1000;
  const last = data?.length ? Math.max(...data.map(deadlineOf)) : null;

  // 리렌더를 트리거하기만 합니다. 값은 아래에서 매번 다시 잽니다
  useCountdown(last);

  const now = Date.now();
  return (data ?? [])
    .map((hold) => ({
      hold,
      remainSeconds: Math.max(0, Math.ceil((deadlineOf(hold) - now) / 1000)),
    }))
    .filter((entry) => entry.remainSeconds > 0);
}
