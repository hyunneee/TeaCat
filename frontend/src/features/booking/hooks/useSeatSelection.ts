import { useCallback } from 'react';
import { toast } from '@/shared/stores';
import { useBookingStore } from '../store/bookingStore';
import { validateSelection } from '../model/seat.model';
import type { Seat } from '../model/booking.types';

/**
 * "좌석을 클릭했을 때 무슨 일이 일어나는가" — Controller 레이어.
 * SeatMap 컴포넌트는 그리기만 하고, 판단은 전부 여기서 합니다.
 */
export function useSeatSelection(maxPerUser: number) {
  const selectedSeatIds = useBookingStore((s) => s.selectedSeatIds);
  const toggleSeat = useBookingStore((s) => s.toggleSeat);

  const select = useCallback(
    (seat: Seat) => {
      const error = validateSelection(seat, selectedSeatIds, maxPerUser);

      if (error === 'LIMIT_EXCEEDED') {
        toast.error(`최대 ${maxPerUser}매까지 선택할 수 있어요.`);
        return;
      }
      if (error === 'NOT_SELECTABLE') {
        toast.info('선택할 수 없는 좌석이에요.');
        return;
      }
      toggleSeat(seat.id);
    },
    [selectedSeatIds, maxPerUser, toggleSeat],
  );

  return { selectedSeatIds, select, count: selectedSeatIds.length };
}
