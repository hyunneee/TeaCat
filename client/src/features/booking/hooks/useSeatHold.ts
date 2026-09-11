import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError, queryClient } from '@/shared/api';
import { useCountdown } from '@/shared/hooks';
import { toast } from '@/shared/stores';
import { ROUTES } from '@/shared/constants';
import { bookingApi, bookingKeys } from '../api/bookingApi';
import { useBookingStore } from '../store/bookingStore';
import type { MyHold } from '../model/booking.types';

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
 *    좌석을 바꾸려면 기존 선점을 먼저 해제해야 하고, 안 하면 ERR_BOOKING_006 으로 거절됩니다.
 *
 * ── 좌석 바꾸기: 놓고 → 잡기 ─────────────────────────────────
 * 결제까지 갔다가 뒤로 돌아와 **다른 자리를 고르는 것은 정상적인 사용**입니다.
 * 그런데 예전에는 그때마다 서버가 006 으로 거절했고, 화면은 그 오류를 받고 다시
 * 예매 확인으로 돌려보냈습니다 — 사용자는 자리를 영영 못 바꾸고 두 화면 사이를
 * 오갈 뿐이었습니다. (스토어에 선점이 없는 경우엔 구역 선택까지 튕겼습니다)
 *
 * 그래서 새 좌석을 잡기 전에 **쥐고 있던 좌석을 먼저 놓습니다.** 스토어가 모르는
 * 선점이 서버에 남아 있을 수도 있어(탭을 닫았다가 다시 온 경우), 006 을 받으면
 * `GET /me/holds` 로 무엇을 쥐고 있는지 물어 놓고 한 번만 다시 시도합니다.
 *
 * 🔴 놓았다 잡는 사이(~100ms)에 남이 그 자리를 채갈 수 있습니다. 그러면 **이전 자리까지
 *    없어집니다.** 서버에 "자리 바꾸기" 를 한 번에 하는 API 가 없어서 피할 수 없고,
 *    대신 그 사실을 좌석 화면에 미리 적어두고 실패했을 때도 그대로 알려줍니다.
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

  /**
   * 방금 놓은 좌석을 `/me/holds` 캐시에서 **즉시** 빼냅니다.
   *
   * 🔴 이게 없으면 놓은 자리가 되살아납니다. 해제하면 스토어를 비우는데,
   *    그 순간 `useResumeHold` 가 **아직 갱신되지 않은 캐시**를 보고 "서버에 선점이
   *    남아 있다" 고 판단해 방금 놓은 좌석을 스토어에 다시 넣었습니다.
   *    화면에는 안내가 되살아나고, 다시 놓기를 누르면 서버에는 이미 없어서
   *    "놓을 자리가 없다" 는 오류가 났습니다. (QA 에서 잡힌 증상)
   *
   * invalidate 만으로는 부족합니다 — 재조회가 끝나기 전에 그 틈이 생깁니다.
   * 무효화보다 **먼저** 캐시에서 빼야 합니다.
   *
   * 다른 회차의 선점은 그대로 둡니다. 한 사람이 여러 회차를 잡아둘 수 있고,
   * 전부 비우면 홈의 "결제를 마치지 않은 자리" 가 통째로 사라집니다.
   */
  const dropFromMyHolds = (...seatIds: string[]) => {
    queryClient.setQueryData<MyHold[]>(bookingKeys.myHolds(), (prev) =>
      prev?.filter((h) => !(h.scheduleId === scheduleId && seatIds.includes(h.seatId))),
    );
  };

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

  /**
   * 이 회차에 남아 있는 내 선점을 놓습니다 (스토어가 모르는 것까지).
   *
   * 해제 실패는 삼킵니다 — 이미 만료됐거나 남이 가져간 뒤라면 어차피 놓여 있는 것이고,
   * 여기서 예외를 던지면 정작 하려던 "새 좌석 잡기" 를 못 하게 됩니다.
   *
   * @returns 놓은 좌석이 있었는지
   */
  const releaseServerHolds = async (): Promise<boolean> => {
    const holds = await bookingApi.myHolds().catch(() => []);
    const mine = holds.filter((h) => h.scheduleId === scheduleId);
    if (mine.length === 0) return false;

    await Promise.all(
      mine.map((h) => bookingApi.releaseHold(scheduleId, h.seatId).catch(() => undefined)),
    );
    dropFromMyHolds(...mine.map((h) => h.seatId));
    return true;
  };

  /** 직전 시도에서 쥐고 있던 좌석을 놓았는지 — 실패 메시지에 "이전 자리도 풀렸다" 를 덧붙일지 판단합니다 */
  const gaveUpPrevious = useRef(false);

  const holdMutation = useMutation({
    mutationFn: async (seatId: string) => {
      gaveUpPrevious.current = false;
      const previous = useBookingStore.getState().hold;

      /* 1인 1좌석이라 새 좌석을 잡으려면 쥔 것을 먼저 놓아야 합니다.
         같은 좌석을 다시 누른 경우는 놓지 않습니다 — 놓았다 다시 잡으면
         남은 시간만 초기화되고 그 사이 남에게 뺏길 수 있습니다 */
      if (previous && previous.seatId !== seatId) {
        await bookingApi.releaseHold(scheduleId, previous.seatId).catch(() => undefined);
        // 스토어를 비우기 전에 캐시에서도 빼야 합니다 (dropFromMyHolds 주석)
        dropFromMyHolds(previous.seatId);
        setHold(null);
        gaveUpPrevious.current = true;
      }

      try {
        return await bookingApi.hold(scheduleId, seatId);
      } catch (error) {
        // 스토어가 모르는 선점이 서버에 남아 있는 경우. 무엇을 쥐고 있는지 물어 놓고 한 번만 재시도합니다
        if (!ApiError.isApiError(error) || error.code !== BOOKING_ERROR.ALREADY_HOLDING) throw error;

        const released = await releaseServerHolds();
        if (!released) throw error;

        gaveUpPrevious.current = true;
        return await bookingApi.hold(scheduleId, seatId);
      }
    },
    onSuccess: (result) => {
      setHold(result);
      navigate(ROUTES.BOOKING_REVIEW(scheduleId));
    },
    onError: (error) => {
      /* 쥐고 있던 자리를 놓은 뒤에 실패했다면 그 사실을 반드시 말해야 합니다.
         안 그러면 "왜 아까 그 자리도 없어졌지" 가 됩니다 */
      const lostPrevious = gaveUpPrevious.current
        ? ' 이전에 잡아둔 자리도 풀렸어요.'
        : '';

      if (!ApiError.isApiError(error)) {
        toast.error(`좌석 선점에 실패했어요.${lostPrevious}`);
        void invalidateSeats();
        return;
      }

      switch (error.code) {
        case BOOKING_ERROR.HELD_BY_OTHER:
        case BOOKING_ERROR.SOLD:
          toast.error(`방금 다른 분이 선택한 좌석이에요. 다른 좌석을 골라주세요.${lostPrevious}`);
          clearSelection();
          void invalidateSeats();
          return;

        case BOOKING_ERROR.ALREADY_HOLDING:
          /* 놓기까지 시도했는데도 남아 있는 경우입니다. 여기서 예매 확인으로 보내면
             스토어에 선점이 없을 때 구역 선택까지 튕겨서 더 헤맵니다 — 그냥 알리고 멈춥니다 */
          toast.error('잡아둔 좌석을 정리하지 못했어요. 잠시 후 다시 시도해 주세요.');
          void queryClient.invalidateQueries({ queryKey: bookingKeys.myHolds() });
          void invalidateSeats();
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
          toast.error(`${error.message}${lostPrevious}`);
          void invalidateSeats();
      }
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (seatId: string) => bookingApi.releaseHold(scheduleId, seatId),
    /* 실패해도 스토어를 비웁니다(onSettled). 해제가 실패하는 경우는 대개
       이미 만료됐거나 남이 가져간 뒤라서, 붙들고 있어 봐야 사용자만 헷갈립니다 */
    onSettled: (_data, _error, seatId) => {
      // 🔴 순서가 중요합니다 — 캐시에서 빼기 → 스토어 비우기 → 무효화
      dropFromMyHolds(seatId);
      setHold(null);
      clearSelection();
      void invalidateSeats();
      void queryClient.invalidateQueries({ queryKey: bookingKeys.myHolds() });
    },
    onSuccess: () => {
      toast.info('자리를 놓았어요. 다시 고를 수 있어요.');
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
