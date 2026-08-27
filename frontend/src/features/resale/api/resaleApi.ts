import { http } from '@/shared/api';
import type {
  ApplyResaleRequest,
  DrawResult,
  ResaleEntry,
  ResaleSection,
} from '../model/resale.types';

export const resaleApi = {
  sections: (scheduleId: string) =>
    http.get<ResaleSection[]>(`/schedules/${scheduleId}/resale/sections`),

  apply: (scheduleId: string, body: ApplyResaleRequest) =>
    http.post<ResaleEntry>(`/schedules/${scheduleId}/resale`, body),

  myEntries: () => http.get<ResaleEntry[]>('/me/resale'),

  cancel: (entryId: string) => http.delete<void>(`/resale/${entryId}`),

  /**
   * [데모 전용] 즉시 추첨.
   * 실제로는 취소표가 나오는 순간 서버가 NRF 로 돌리고 메일로 알립니다.
   */
  draw: (entryId: string) => http.post<DrawResult>(`/resale/${entryId}/draw`),
};

export const resaleKeys = {
  all: ['resale'] as const,
  sections: (scheduleId: string) => [...resaleKeys.all, 'sections', scheduleId] as const,
  mine: () => [...resaleKeys.all, 'mine'] as const,
};
