import { http } from '@/shared/api';
import type { CursorPage } from '@/shared/types';
import type { ConcertDetail, ConcertSummary, ScheduleDetail } from '../model/concert.types';

export const concertApi = {
  list: (keyword?: string) =>
    http.get<CursorPage<ConcertSummary>>('/concerts', { params: { keyword } }),

  detail: (concertId: string) => http.get<ConcertDetail>(`/concerts/${concertId}`),

  schedule: (scheduleId: string) => http.get<ScheduleDetail>(`/schedules/${scheduleId}`),
};

export const concertKeys = {
  all: ['concert'] as const,
  list: (keyword?: string) => [...concertKeys.all, 'list', keyword ?? ''] as const,
  detail: (concertId: string) => [...concertKeys.all, 'detail', concertId] as const,
  schedule: (scheduleId: string) => [...concertKeys.all, 'schedule', scheduleId] as const,
};
