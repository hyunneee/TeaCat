import { http } from '@/shared/api';
import type { AdminPackEvent, AdminPackEventCreateRequest } from '../model/adminPackEvent.types';

const BASE = '/admin/photocard-pack-events';

export const adminPackEventKeys = {
  all: ['admin', 'packEvents'] as const,
  list: () => [...adminPackEventKeys.all, 'list'] as const,
};

/**
 * 카드팩 이벤트 API (Model 레이어). 전부 서버에서 ADMIN 전용입니다.
 *
 * 🔴 **수정은 스위치(`active`)뿐입니다.** 코드·기간은 등록 뒤에 못 바꿉니다 —
 * 코드가 계정당 1회의 기준이라, 바꾸면 이미 받은 사람이 또 받습니다.
 */
export const adminPackEventApi = {
  /** 최신순 */
  list: () => http.get<AdminPackEvent[]>(BASE),

  create: (body: AdminPackEventCreateRequest) => http.post<AdminPackEvent>(BASE, body),

  /** 열기/닫기. 닫아도 **이미 받은 팩은 회수되지 않습니다** */
  setActive: (eventId: number, active: boolean) =>
    http.patch<AdminPackEvent>(`${BASE}/${eventId}`, { active }),
};
