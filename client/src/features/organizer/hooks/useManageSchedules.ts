import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/stores';
import { concertKeys } from '@/features/concert';
import { organizerApi } from '../api/organizerApi';

/**
 * 수정 화면의 회차 추가·삭제.
 *
 * 공연 정보 저장 버튼과 묶지 않고 **누르는 즉시** 서버에 반영합니다.
 * 저장을 눌러야 적용되는 목록은 "추가했는데 왜 안 보이지" 가 되고,
 * 회차 삭제는 되돌릴 수 없어 저장 전 대기 상태와 섞이면 헷갈립니다.
 *
 * 성공하면 공연 상세 캐시를 비워 목록이 서버 기준으로 다시 그려집니다 (회차는 상세 응답에 들어 있음).
 */
export function useAddSchedule(concertId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (performanceDate: string) => organizerApi.createSchedule(concertId, performanceDate),
    retry: false,
    onSuccess: ({ performanceNum }) => {
      void queryClient.invalidateQueries({ queryKey: concertKeys.all });
      toast.success(`${performanceNum}회차를 추가했어요.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '회차를 추가하지 못했어요.');
    },
  });
}

/** 회차 삭제 — 되돌릴 수 없습니다. 호출부는 `danger` 확인 모달을 먼저 띄웁니다. */
export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) => organizerApi.deleteSchedule(scheduleId),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: concertKeys.all });
      toast.success('회차를 삭제했어요.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '회차를 삭제하지 못했어요.');
    },
  });
}
