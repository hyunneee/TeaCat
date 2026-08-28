import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError, ERROR_CODE, queryClient } from '@/shared/api';
import { useCountdown } from '@/shared/hooks';
import { toast } from '@/shared/stores';
import { ROUTES } from '@/shared/constants';
import { bookingApi, bookingKeys } from '../api/bookingApi';
import { useBookingStore } from '../store/bookingStore';

/**
 * 좌석 선점(락)과 만료 타이머를 담당합니다.
 *
 * ── 동시 결제 문제에서 프론트의 역할 ──────────────────────────
 * 진짜 락은 서버가 잡습니다(Redis 분산락 등). 프론트가 할 수 있는 건 셋입니다.
 *   1) 요청을 한 번만 보내기       : isPending 으로 버튼 잠금 + 멱등키
 *   2) 락 실패를 곱게 처리하기      : SEAT_ALREADY_HELD 시 좌석맵 갱신 + 선택 해제
 *   3) 만료를 정확히 알려주기       : 서버가 준 expiresAt 기준 카운트다운
 * 프론트에서 "누가 먼저 눌렀는지" 를 판정하려는 시도는 전부 틀립니다.
 *
 * 플로우차트대로, 기한이 만료되면 그 좌석은 NRF 추첨 풀로 돌아갑니다.
 */
export function useSeatHold(scheduleId: string) {
  const navigate = useNavigate();
  const sectionId = useBookingStore((s) => s.sectionId);
  const selectedSeatIds = useBookingStore((s) => s.selectedSeatIds);
  const hold = useBookingStore((s) => s.hold);
  const setHold = useBookingStore((s) => s.setHold);
  const clearSelection = useBookingStore((s) => s.clearSelection);

  const expiresAt = hold ? new Date(hold.expiresAt).getTime() : null;
  const remainSeconds = useCountdown(expiresAt);

  const invalidateSeats = () =>
    queryClient.invalidateQueries({
      queryKey: bookingKeys.seatMap(scheduleId, sectionId ?? undefined),
    });

  // 만료되면 선점이 풀린 것으로 보고 좌석 선택 화면으로 되돌립니다.
  useEffect(() => {
    if (!hold || remainSeconds > 0) return;
    // 이중 안전장치: 카운트다운 값과 별개로 실제 만료 시각도 확인합니다.
    // (0 이 잘못 흘러들어와 갓 잡은 좌석을 풀어버리는 사고 방지)
    if (expiresAt !== null && expiresAt > Date.now()) return;

    setHold(null);
    clearSelection();
    void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    toast.error('시간이 초과되어 좌석 선점이 해제되었어요.');
    navigate(ROUTES.BOOKING_SEATS(scheduleId), { replace: true });
  }, [hold, remainSeconds, expiresAt, scheduleId, setHold, clearSelection, navigate]);

  const holdMutation = useMutation({
    mutationFn: () => bookingApi.hold(scheduleId, selectedSeatIds),
    onSuccess: (result) => {
      setHold(result);
      navigate(ROUTES.BOOKING_REVIEW(scheduleId));
    },
    onError: (error) => {
      if (!ApiError.isApiError(error)) {
        toast.error('좌석 선점에 실패했어요.');
        return;
      }

      if (error.code === ERROR_CODE.SEAT_ALREADY_HELD) {
        toast.error('방금 다른 분이 선택한 좌석이에요. 다른 좌석을 골라주세요.');
        clearSelection();
        void invalidateSeats();
        return;
      }

      if (error.code === 'CAPTCHA_REQUIRED') {
        toast.error('본인 인증이 필요해요.');
        navigate(ROUTES.BOOKING_VERIFY(scheduleId), { replace: true });
        return;
      }

      toast.error(error.message);
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (holdId: string) => bookingApi.releaseHold(holdId),
    onSettled: () => {
      setHold(null);
      void invalidateSeats();
    },
  });

  return {
    hold,
    remainSeconds,
    /** 좌석 선점 시도. isHolding 동안 버튼을 잠가 중복 요청을 막으세요. */
    holdSeats: () => holdMutation.mutate(),
    isHolding: holdMutation.isPending,
    releaseHold: () => {
      if (hold) releaseMutation.mutate(hold.holdId);
    },
    isReleasing: releaseMutation.isPending,
  };
}
