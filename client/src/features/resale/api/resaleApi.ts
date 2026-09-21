import { http } from '@/shared/api';
import type { ApplyResaleRequest, ResaleEntry, ResaleSection } from '../model/resale.types';

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

  /* "즉시 추첨" API 는 없습니다. 추첨은 취소표가 생기는 순간 서버가 온체인으로 돌리고,
     사용자는 결과만 봅니다 — 사용자가 돌릴 수 있는 것처럼 보이면 공정성이 의심받습니다. */
};

export const resaleKeys = {
  all: ['resale'] as const,
  sections: (scheduleId: string) => [...resaleKeys.all, 'sections', scheduleId] as const,
  mine: () => [...resaleKeys.all, 'mine'] as const,
};
