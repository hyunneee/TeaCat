import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { STALE_TIME } from '@/shared/constants';
import { adminPackEventApi, adminPackEventKeys } from '../api/adminPackEventApi';
import type { AdminPackEventCreateRequest } from '../model/adminPackEvent.types';

const message = (error: unknown, fallback: string) =>
  ApiError.isApiError(error) ? error.message : fallback;

export function useAdminPackEvents() {
  return useQuery({
    queryKey: adminPackEventKeys.list(),
    queryFn: adminPackEventApi.list,
    staleTime: STALE_TIME.SHORT,
  });
}

export function useCreatePackEvent() {
  return useMutation({
    mutationFn: (body: AdminPackEventCreateRequest) => adminPackEventApi.create(body),
    /* 코드가 계정당 1회의 기준이라 같은 이벤트가 두 개 생기면 두 번 받습니다 */
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminPackEventKeys.all });
      toast.success('카드팩 이벤트를 열었어요.');
    },
    onError: (error) => toast.error(message(error, '이벤트를 등록하지 못했어요.')),
  });
}

export function useSetPackEventActive() {
  return useMutation({
    mutationFn: ({ eventId, active }: { eventId: number; active: boolean }) =>
      adminPackEventApi.setActive(eventId, active),
    retry: false,
    onSuccess: (_, { active }) => {
      void queryClient.invalidateQueries({ queryKey: adminPackEventKeys.all });
      toast.success(active ? '이벤트를 열었어요.' : '이벤트를 닫았어요.');
    },
    onError: (error) => toast.error(message(error, '이벤트를 바꾸지 못했어요.')),
  });
}
