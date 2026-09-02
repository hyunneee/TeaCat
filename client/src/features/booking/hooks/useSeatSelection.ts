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
  const clearSelection = useBookingStore((s) => s.clearSelection);

  const select = useCallback(
    (seat: Seat) => {
      /* 1인 1매 정책에서는 "한도 초과" 를 띄우는 대신 **갈아타기** 가 자연스럽습니다.
         어차피 한 자리만 고를 수 있으니, 다른 좌석을 누르면 그쪽으로 옮겨줍니다.
         (매번 "최대 1매까지" 토스트가 뜨면 선택을 못 바꾸는 것처럼 보입니다) */
      const swapping =
        maxPerUser === 1 && selectedSeatIds.length > 0 && !selectedSeatIds.includes(seat.id);

      const error = validateSelection(seat, swapping ? [] : selectedSeatIds, maxPerUser);

      if (error === 'LIMIT_EXCEEDED') {
        toast.error(`최대 ${maxPerUser}매까지 선택할 수 있어요.`);
        return;
      }
      if (error === 'NOT_SELECTABLE') {
        toast.info('선택할 수 없는 좌석이에요.');
        return;
      }

      if (swapping) clearSelection();
      toggleSeat(seat.id);
    },
    [selectedSeatIds, maxPerUser, toggleSeat, clearSelection],
  );

  return { selectedSeatIds, select, count: selectedSeatIds.length };
}
