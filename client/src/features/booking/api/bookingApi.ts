import { http, newIdempotencyKey } from '@/shared/api';
import type {
  HoldDetail,
  SeatHold,
  SeatMapData,
  Section,
} from '../model/booking.types';

export const bookingApi = {
  sections: (scheduleId: string) => http.get<Section[]>(`/schedules/${scheduleId}/sections`),

  seatMap: (scheduleId: string, sectionId?: string) =>
    http.get<SeatMapData>(`/schedules/${scheduleId}/seats`, { params: { sectionId } }),

  /**
   * 좌석 선점. 동시 요청 중 한 명만 성공하고 나머지는 SEAT_ALREADY_HELD 로 실패합니다.
   * 실제 락은 서버(Redis 분산락 등)가 잡습니다 — 프론트는 실패를 곱게 처리하는 게 역할입니다.
   */
  hold: (scheduleId: string, seatIds: string[]) =>
    http.post<SeatHold>(
      `/schedules/${scheduleId}/holds`,
      { seatIds },
      // 더블클릭/재시도로 락을 두 번 잡지 않도록 멱등키 부여
      { idempotencyKey: newIdempotencyKey() },
    ),

  holdDetail: (holdId: string) => http.get<HoldDetail>(`/holds/${holdId}`),

  releaseHold: (holdId: string) => http.delete<void>(`/holds/${holdId}`),

  // 결제(주문 생성·승인)는 features/payment 가 담당합니다.
  // PG 연동이 얽히는 부분이라 예매(좌석 락)와 분리했습니다.
};

export const bookingKeys = {
  all: ['booking'] as const,
  sections: (scheduleId: string) => [...bookingKeys.all, 'sections', scheduleId] as const,
  seatMap: (scheduleId: string, sectionId?: string) =>
    [...bookingKeys.all, 'seatMap', scheduleId, sectionId ?? 'all'] as const,
  hold: (holdId: string) => [...bookingKeys.all, 'hold', holdId] as const,
};
