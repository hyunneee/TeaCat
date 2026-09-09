import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError, queryClient } from '@/shared/api';
import { useCountdown } from '@/shared/hooks';
import { toast } from '@/shared/stores';
import { ROUTES } from '@/shared/constants';
import { bookingApi, bookingKeys } from '../api/bookingApi';
import { useBookingStore } from '../store/bookingStore';

/**
 * 좌석 선점(락)과 만료 타이머.
 *
 * ── 동시 결제 문제에서 프론트의 역할 ──────────────────────────
 * 진짜 락은 서버가 잡습니다 — `performance_seats` 를 조건부 UPDATE 해서
 * 영향 행이 0이면 이미 남이 잡은 것입니다. 프론트가 할 수 있는 건 셋입니다.
 *   1) 요청을 한 번만 보내기  : isPending 으로 버튼 잠금 + 멱등키
 *   2) 실패를 곱게 처리하기    : 좌석맵 갱신 + 선택 해제
 *   3) 만료를 정확히 알려주기  : 서버가 준 남은 초 기준 카운트다운
 * 프론트에서 "누가 먼저 눌렀는지" 를 판정하려는 시도는 전부 틀립니다.
 *
 * 🔴 **한 사용자는 회차당 좌석 하나만** 선점합니다 (서버 제약).
 *    좌석을 바꾸려면 기존 선점을 먼저 해제해야 하고, 안 하면
 *    ERR_BOOKING_006 으로 거절됩니다. 아래에서 그 경우를 잡아 안내합니다.
 */

/** 서버 BookingErrorCode 중 프론트가 분기하는 것만 */
const BOOKING_ERROR = {
  /** 예매 가능한 시간이 아님 */
  NOT_OPEN: 'ERR_BOOKING_003',
  /** 다른 사용자가 선점한 좌석 */
  HELD_BY_OTHER: 'ERR_BOOKING_004',
  /** 이미 판매된 좌석 */
  SOLD: 'ERR_BOOKING_005',
  /** 다른 좌석을 선점 중 (1인 1좌석) */
  ALREADY_HOLDING: 'ERR_BOOKING_006',
  /** 본인이 이미 선점한 좌석 — 연장 불가 */
  SAME_SEAT: 'ERR_BOOKING_010',
} as const;

export function useSeatHold(scheduleId: string) {
  const navigate = useNavigate();
  const selectedSeatIds = useBookingStore((s) => s.selectedSeatIds);
  const hold = useBookingStore((s) => s.hold);
  const setHold = useBookingStore((s) => s.setHold);
  const clearSelection = useBookingStore((s) => s.clearSelection);

  /* 서버가 준 남은 초를 기준 시각으로 환산해 카운트다운합니다.
     🔴 heldUntil 을 클라이언트 시계로 계산하면 기기 시각이 틀어진 사용자에게
        엉뚱한 타이머가 보입니다. 서버가 계산해 준 remainingSeconds 만 믿습니다. */
  const deadline = hold ? hold.receivedAt + hold.remainingSeconds * 1000 : null;
  const remainSeconds = useCountdown(deadline);

  const invalidateSeats = () =>
    queryClient.invalidateQueries({ queryKey: bookingKeys.seatMap(scheduleId) });

  // 만료되면 선점이 풀린 것으로 보고 좌석 선택 화면으로 되돌립니다.
  useEffect(() => {
    if (!hold || remainSeconds > 0) return;
    // 이중 안전장치: 카운트다운 값과 별개로 실제 만료 시각도 확인합니다.
    // (0 이 잘못 흘러들어와 갓 잡은 좌석을 풀어버리는 사고 방지)
    if (deadline !== null && deadline > Date.now()) return;

    setHold(null);
    clearSelection();
    void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    toast.error('시간이 초과되어 좌석 선점이 해제되었어요.');
    navigate(ROUTES.BOOKING_SEATS(scheduleId), { replace: true });
  }, [hold, remainSeconds, deadline, scheduleId, setHold, clearSelection, navigate]);

  const holdMutation = useMutation({
    mutationFn: (seatId: string) => bookingApi.hold(scheduleId, seatId),
    onSuccess: (result) => {
      setHold(result);
      navigate(ROUTES.BOOKING_REVIEW(scheduleId));
    },
    onError: (error) => {
      if (!ApiError.isApiError(error)) {
        toast.error('좌석 선점에 실패했어요.');
        return;
      }

      switch (error.code) {
        case BOOKING_ERROR.HELD_BY_OTHER:
        case BOOKING_ERROR.SOLD:
          toast.error('방금 다른 분이 선택한 좌석이에요. 다른 좌석을 골라주세요.');
          clearSelection();
          void invalidateSeats();
          return;

        case BOOKING_ERROR.ALREADY_HOLDING:
          /* 이전 판의 선점이 서버에 남아 있는 경우입니다 (탭을 닫았다가 다시 온 등).
             프론트 스토어에는 없어서 사용자는 아무것도 안 잡은 줄 압니다.
             결제 화면으로 보내 정리하게 합니다 — 거기서 해제하거나 결제합니다. */
          toast.error('이미 선점한 좌석이 있어요. 먼저 정리해 주세요.');
          void queryClient.invalidateQueries({ queryKey: bookingKeys.myHolds() });
          navigate(ROUTES.BOOKING_REVIEW(scheduleId));
          return;

        case BOOKING_ERROR.SAME_SEAT:
          // 이미 내가 잡은 좌석을 다시 누른 것. 연장은 안 되지만 실패도 아닙니다
          toast.info('이미 선점한 좌석이에요.');
          navigate(ROUTES.BOOKING_REVIEW(scheduleId));
          return;

        case BOOKING_ERROR.NOT_OPEN:
          toast.error('아직 예매 가능한 시간이 아니에요.');
          void invalidateSeats();
          return;

        default:
          toast.error(error.message);
      }
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (seatId: string) => bookingApi.releaseHold(scheduleId, seatId),
    onSettled: () => {
      setHold(null);
      void invalidateSeats();
      void queryClient.invalidateQueries({ queryKey: bookingKeys.myHolds() });
    },
  });

  return {
    hold,
    remainSeconds,
    /**
     * 선택한 좌석을 선점합니다. 1인 1좌석이라 **첫 좌석 하나만** 보냅니다.
     * isHolding 동안 버튼을 잠가 중복 요청을 막으세요.
     */
    holdSeats: () => {
      const seatId = selectedSeatIds[0];
      if (!seatId) return;
      holdMutation.mutate(seatId);
    },
    isHolding: holdMutation.isPending,
    releaseHold: () => {
      if (hold) releaseMutation.mutate(hold.seatId);
    },
    isReleasing: releaseMutation.isPending,
  };
}
