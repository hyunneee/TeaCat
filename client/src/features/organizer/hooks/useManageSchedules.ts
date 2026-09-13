import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/stores';
import { concertKeys } from '@/features/concert';
import { bookingKeys } from '@/features/booking';
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

/**
 * 회차 좌석 생성.
 *
 * 🔴 회차를 만들어도 좌석 행은 생기지 않습니다. 이걸 돌려야 예매가 열립니다 —
 *    안 돌리면 좌석맵이 전 좌석을 `BLOCKED` 로 내려주고, 예매 화면은 그 구역을
 *    고를 수 없게 막습니다("준비 중").
 *
 * 성공하면 좌석맵 캐시도 비웁니다. 안 그러면 방금 연 회차가 예매 화면에서
 * 한동안 계속 "준비 중" 으로 보입니다.
 */
export function useGenerateSeats() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) => organizerApi.generateSeats(scheduleId),
    retry: false,
    onSuccess: ({ createdSeatCount, seatedAreaCount }) => {
      void queryClient.invalidateQueries({ queryKey: concertKeys.all });
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });

      toast.success(`${seatedAreaCount}개 구역에 좌석 재고 ${createdSeatCount}개를 만들었어요.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '좌석을 만들지 못했어요.');
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
