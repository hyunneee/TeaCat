import { useMemo } from 'react';
import type { Seat, Section } from '../model/booking.types';
import { useSeatMap } from './useSeatMap';

/**
 * 한 구역의 좌석만 골라 줍니다 (좌석 선택 화면).
 *
 * 서버는 전 구역을 한 응답에 주므로 필터는 클라이언트에서 합니다.
 * 🔴 `useMemo` 가 필요합니다. 3초마다 폴링하는 쿼리라서 메모이즈하지 않으면
 *    응답마다 새 배열이 만들어져 좌석 수백 개가 매번 다시 그려집니다.
 */
export function useSectionSeats(scheduleId: string, sectionId: string | null) {
  const query = useSeatMap(scheduleId);

  const section: Section | undefined = useMemo(
    () => query.data?.sections.find((s) => s.id === sectionId),
    [query.data?.sections, sectionId],
  );

  const seats: Seat[] = useMemo(
    () => query.data?.seats.filter((s) => s.sectionId === sectionId) ?? [],
    [query.data?.seats, sectionId],
  );

  return { ...query, section, seats };
}
