import { http } from '@/shared/api';
import type { ConcertDetail, ConcertListPage, ScheduleDetail } from '../model/concert.types';

export const concertApi = {
  /** 공연 목록 (API-201). 검색어는 제목 부분 일치 */
  list: (keyword?: string) =>
    http.get<ConcertListPage>('/concerts', { params: { keyword } }),

  /** 공연 상세 (API-202) */
  detail: (concertId: string) => http.get<ConcertDetail>(`/concerts/${concertId}`),

  /** 회차 단건 (API-203) */
  schedule: (scheduleId: string) => http.get<ScheduleDetail>(`/schedules/${scheduleId}`),
};

export const concertKeys = {
  all: ['concert'] as const,
  list: (keyword?: string) => [...concertKeys.all, 'list', keyword ?? ''] as const,
  detail: (concertId: string) => [...concertKeys.all, 'detail', concertId] as const,
  schedule: (scheduleId: string) => [...concertKeys.all, 'schedule', scheduleId] as const,
};
