import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { trackGaEvent } from '@/shared/lib';
import { queueApi, queueKeys } from '../api/queueApi';
import { nextPollMs } from '../model/queue.model';
import { QUEUE_ERROR } from '../model/queue.types';

/**
 * 내 대기 상태. 대기 중이면 서버가 알려준 주기로 폴링하고, 입장하거나 대기실이 꺼진 회차면 멈춥니다.
 *
 * 백그라운드 탭에서는 폴링을 멈춥니다 — 서버 부담도 줄고, 돌아오면 `refetchOnReconnect`/재마운트가 최신을 맞춥니다.
 * 🔴 대기실이 켜진 회차에서 이 쿼리가 실패해도 예매를 막지 않습니다(`RequireQueue`). 최종 방어선은 서버 인터셉터입니다.
 */
export function useQueueStatus(scheduleId: string) {
  return useQuery({
    queryKey: queueKeys.status(scheduleId),
    queryFn: () => queueApi.status(scheduleId),
    enabled: !!scheduleId,
    staleTime: STALE_TIME.REALTIME,
    refetchInterval: (query) => nextPollMs(query.state.data),
    refetchIntervalInBackground: false,
  });
}

/**
 * 대기실 화면용. 상태를 폴링하다가 입장이 확정되면 `onAdmitted` 를 **한 번** 부릅니다.
 * 대기실이 꺼진 회차도 admitted 라 같은 길로 나갑니다.
 */
export function useQueueWaiting(scheduleId: string, onAdmitted: () => void) {
  const status = useQueueStatus(scheduleId);
  const fired = useRef(false);
  const callback = useRef(onAdmitted);
  callback.current = onAdmitted;

  const admitted = status.data?.admitted === true;
  useEffect(() => {
    if (!admitted || fired.current) return;
    fired.current = true;
    trackGaEvent('queue_admitted', { schedule_id: scheduleId });
    callback.current();
  }, [admitted, scheduleId]);

  return status;
}

/**
 * 결제 완료 등 예매 플로우가 끝났을 때 자리를 비웁니다. 실패해도 무시합니다 — 서버 TTL 이 뒤처리합니다.
 */
export function useLeaveQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scheduleId: string) => queueApi.leave(scheduleId),
    onSettled: (_data, _error, scheduleId) => {
      queryClient.removeQueries({ queryKey: queueKeys.status(scheduleId) });
    },
  });
}

/**
 * 입장 표식이 사라졌을 때(무활동 만료 · 관리자 초기화) 좌석 페이지에서 알아채는 장치.
 *
 * 좌석맵 폴링이나 선점 요청이 `ERR_QUEUE_002`(428) 로 실패하면 `onEvicted` 를 부릅니다.
 * 요청마다 catch 를 심는 대신 TanStack Query 의 캐시 이벤트를 구독합니다 — 이 훅이 마운트된 동안
 * 어느 쿼리·뮤테이션이 428 을 받아도 한 곳에서 잡힙니다. 예매 플로우 전체를 감싸는 가드에서 씁니다.
 *
 * (shared 의 axios 인터셉터에 넣지 않는 이유: shared 는 도메인과 라우터를 모릅니다 — CLAUDE.md 3-2)
 */
export function useQueueEviction(scheduleId: string, onEvicted: () => void) {
  const queryClient = useQueryClient();
  const callback = useRef(onEvicted);
  callback.current = onEvicted;

  useEffect(() => {
    const isEviction = (error: unknown) =>
      ApiError.isApiError(error) && error.code === QUEUE_ERROR.NOT_ADMITTED;

    const evicted = () => {
      trackGaEvent('queue_evicted', { schedule_id: scheduleId });
      // 대기실 화면이 최신 순번을 바로 받도록. 서버는 표식 없는 사용자를 다시 줄 뒤에 세운다
      void queryClient.invalidateQueries({ queryKey: queueKeys.status(scheduleId) });
      callback.current();
    };

    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.action.type === 'error' &&
        isEviction(event.action.error)
      ) {
        evicted();
      }
    });
    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.action.type === 'error' &&
        isEviction(event.action.error)
      ) {
        evicted();
      }
    });
    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [queryClient, scheduleId]);
}
