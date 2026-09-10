import { useEffect } from 'react';
import { useMyHolds } from './useMyHolds';
import { useBookingStore } from '../store/bookingStore';

/**
 * 서버에만 남아 있는 선점을 예매 플로우로 되살립니다.
 *
 * 🔴 선점의 원본은 서버입니다. 스토어는 sessionStorage 라 탭을 닫으면 사라지고,
 *    봇 확인을 다시 통과하면(`beginFlow`) 일부러 비웁니다. 그때도 서버 선점은
 *    남아 있어서, 되살리지 않으면 사용자는 **자기가 잡아둔 자리를 남의 자리처럼**
 *    보게 됩니다. 눌러도 `ERR_BOOKING_010`(연장 불가)으로 막히고, 선점이 만료될
 *    때까지 그 자리를 살 수도 놓을 수도 없습니다.
 *
 * 남은 시간은 응답을 받은 뒤 흐른 만큼 빼서 넘깁니다. 캐시된 응답으로 되살리면
 * 타이머가 실제보다 길게 보입니다.
 *
 * @returns `isResuming` — 되살릴 게 있는지 확인하는 중. "선점이 없다" 고 단정해
 *          플로우 밖으로 내보내기 전에 이걸 기다려야 합니다.
 */
export function useResumeHold(scheduleId: string): { isResuming: boolean } {
  const hold = useBookingStore((s) => s.hold);
  const setHold = useBookingStore((s) => s.setHold);
  const { data: holds, dataUpdatedAt, isLoading } = useMyHolds();

  useEffect(() => {
    if (hold || !holds) return;

    const mine = holds.find((h) => h.scheduleId === scheduleId);
    if (!mine) return;

    const elapsed = Math.max(0, Math.floor((Date.now() - dataUpdatedAt) / 1000));
    const remainingSeconds = mine.remainingSeconds - elapsed;
    if (remainingSeconds <= 0) return;

    setHold({
      scheduleId: mine.scheduleId,
      seatId: mine.seatId,
      status: 'HELD',
      expiresAt: mine.expiresAt,
      remainingSeconds,
    });
  }, [hold, holds, dataUpdatedAt, scheduleId, setHold]);

  return { isResuming: !hold && isLoading };
}
