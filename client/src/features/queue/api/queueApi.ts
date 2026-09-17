import { http } from '@/shared/api';
import type { QueueStatus } from '../model/queue.types';

export const queueKeys = {
  all: ['queue'] as const,
  status: (scheduleId: string) => ['queue', 'status', scheduleId] as const,
};

export const queueApi = {
  /**
   * 대기열 진입. 이미 서 있으면 순번을 유지하고, 이미 입장 상태면 그대로 돌려줍니다.
   * 대기실을 운영하지 않는 회차면 `ERR_QUEUE_003`(409).
   */
  enter: (scheduleId: string) => http.post<QueueStatus>(`/queue/${scheduleId}/enter`),

  /**
   * 내 대기 상태. 대기실 화면이 `pollAfterSec` 주기로 부릅니다.
   *
   * 🔴 캐시하지 마세요 (`STALE_TIME.REALTIME`). "지금 들어갈 수 있나" 를 묻는 것입니다.
   * 대기열에도 입장 표식에도 없으면(무활동으로 빠진 뒤 돌아온 경우) 서버가 다시 줄 뒤에 세워 줍니다 —
   * 그래서 화면은 enter 를 따로 부르지 않고 status 만 폴링해도 됩니다.
   */
  status: (scheduleId: string) => http.get<QueueStatus>(`/queue/${scheduleId}/status`),

  /**
   * 대기열 이탈. 결제 완료 화면에서 부릅니다. 부르지 못해도 무활동 10분 뒤 자동으로 빠집니다.
   *
   * 🔴 새로고침·뒤로가기에서는 부르지 마세요. 자리를 잃고 줄 맨 뒤로 갑니다.
   */
  leave: (scheduleId: string) => http.delete<void>(`/queue/${scheduleId}/leave`),
};
