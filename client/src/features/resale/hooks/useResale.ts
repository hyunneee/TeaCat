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

/**
 * 내 대기 내역.
 *
 * `options` 는 알림 감시(ResaleWinNotifier)처럼 **화면 없이 폴링**해야 하는
 * 쪽을 위한 것입니다. 화면에서는 그냥 인자 없이 부르세요.
 */
export function useMyResaleEntries(options?: {
  enabled?: boolean;
  refetchInterval?: number | false;
}) {
  return useQuery({
    queryKey: resaleKeys.mine(),
    queryFn: () => resaleApi.myEntries(),
    staleTime: STALE_TIME.SHORT,
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? false,
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
/**
 * 즉시 추첨.
 *
 * ⚠️ **사용자 화면에서는 쓰지 않습니다.** 추첨은 취소표가 생길 때 서버가 돌립니다.
 *    사용자가 직접 돌릴 수 있는 것처럼 보이면 공정성이 의심받습니다.
 *    운영 도구·데모용으로만 남겨둔 바인딩입니다.
 */
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
