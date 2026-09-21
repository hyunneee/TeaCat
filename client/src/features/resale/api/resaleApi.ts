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

  /**
   * 대기 취소 또는 당첨 포기.
   * `rejoin` 은 당첨을 포기하면서 **다시 대기**할 때만 의미가 있습니다 — 다음 취소표부터 다시 추첨에 들어갑니다.
   */
  cancel: (entryId: string, rejoin = false) =>
    http.delete<void>(`/resale/${entryId}?rejoin=${rejoin ? 'true' : 'false'}`),

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
