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
 * 대기 중일 때 다시 물어보는 주기.
 *
 * 추첨은 취소표가 나오는 순간 서버가 돌리고 약 15초면 끝납니다(다음 블록 10초 + 스위퍼).
 * 그 결과가 화면에 나타나는 속도는 **이 값이 정합니다** — 예전에는 폴링이 없어서, 대기 화면을
 * 열어 둔 채로는 당첨돼도 화면이 그대로였습니다.
 */
const WAITING_POLL_MS = 5_000;

/**
 * 내 대기 내역.
 *
 * 대기 중(WAITING)인 건이 있으면 **스스로 다시 물어봅니다.** 추첨은 사용자가 아무것도 누르지 않는
 * 사이에 끝나므로, 폴링이 없으면 당첨된 줄 모르고 화면을 떠납니다. 대기 중인 건이 없으면 멈춥니다.
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
    refetchInterval:
      options?.refetchInterval ??
      ((query) =>
        query.state.data?.some((entry) => entry.status === 'WAITING') ? WAITING_POLL_MS : false),
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

/** 대기 취소·당첨 포기의 세 갈래. 같은 API 인데 사용자에게 하는 말이 달라야 합니다 */
export type CancelResaleMode = 'cancel' | 'forfeit' | 'forfeit-rejoin';

const CANCEL_MESSAGE: Record<CancelResaleMode, string> = {
  cancel: '대기 신청을 취소했어요.',
  forfeit: '당첨을 포기했어요. 좌석은 남은 대기자끼리 다시 추첨됩니다.',
  'forfeit-rejoin': '당첨을 포기하고 다시 대기를 시작했어요. 다음 취소표부터 추첨에 참여합니다.',
};

/**
 * 대기 취소 또는 당첨 포기.
 * 포기하면 그 좌석은 서버가 **곧바로 다시 추첨**합니다 — 화면이 할 일은 없습니다.
 */
export function useCancelResale() {
  return useMutation({
    mutationFn: ({ entryId, mode }: { entryId: string; mode: CancelResaleMode }) =>
      resaleApi.cancel(entryId, mode === 'forfeit-rejoin'),
    onSuccess: (_, { mode }) => {
      void queryClient.invalidateQueries({ queryKey: resaleKeys.all });
      toast.info(CANCEL_MESSAGE[mode]);
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '처리에 실패했어요.'),
  });
}

