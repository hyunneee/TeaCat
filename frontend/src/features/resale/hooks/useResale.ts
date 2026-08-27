import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { resaleApi, resaleKeys } from '../api/resaleApi';
import type { ApplyResaleRequest } from '../model/resale.types';

/** 구역별 대기 인원 현황 */
export function useResaleSections(scheduleId: string) {
  return useQuery({
    queryKey: resaleKeys.sections(scheduleId),
    queryFn: () => resaleApi.sections(scheduleId),
    staleTime: STALE_TIME.SHORT,
    enabled: !!scheduleId,
  });
}

export function useMyResaleEntries() {
  return useQuery({
    queryKey: resaleKeys.mine(),
    queryFn: () => resaleApi.myEntries(),
    staleTime: STALE_TIME.SHORT,
  });
}

/**
 * 대기 신청.
 * 구역별로 신청하고, 1인 최대 구매 수량까지 여러 구역에 중복 신청할 수 있습니다.
 */
export function useApplyResale(scheduleId: string) {
  return useMutation({
    mutationFn: (body: ApplyResaleRequest) => resaleApi.apply(scheduleId, body),
    onSuccess: (entry) => {
      void queryClient.invalidateQueries({ queryKey: resaleKeys.all });
      toast.success(`${entry.sectionName} 대기 신청이 완료됐어요.`);
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '신청에 실패했어요.'),
  });
}

export function useCancelResale() {
  return useMutation({
    mutationFn: (entryId: string) => resaleApi.cancel(entryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: resaleKeys.all });
      toast.info('대기 신청을 취소했어요.');
    },
  });
}

/** [데모 전용] 추첨 즉시 실행 */
export function useDrawResale() {
  return useMutation({
    mutationFn: (entryId: string) => resaleApi.draw(entryId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: resaleKeys.all });
      if (result.status === 'WON') toast.success('당첨됐어요! 12시간 내에 결제해 주세요.');
      else toast.info('아쉽게도 이번엔 당첨되지 않았어요.');
    },
  });
}
