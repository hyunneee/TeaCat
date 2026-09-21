import type { ResaleEntry, ResaleStatus } from './resale.types';

export const RESALE_STATUS_LABEL: Record<ResaleStatus, string> = {
  WAITING: '추첨 대기',
  WON: '당첨',
  PURCHASED: '예매 완료',
  LOST: '미당첨',
  EXPIRED: '기한 만료',
};

/** 당첨 후 결제 기한이 남아 있는가 */
export function isPayable(entry: ResaleEntry): boolean {
  if (entry.status !== 'WON' || !entry.deadlineAt) return false;
  return new Date(entry.deadlineAt).getTime() > Date.now();
}

/** 결제 마감까지 남은 시간(초). 당첨이 아니면 0. */
export function remainToDeadline(entry: ResaleEntry): number {
  if (!entry.deadlineAt) return 0;
  return Math.max(0, Math.floor((new Date(entry.deadlineAt).getTime() - Date.now()) / 1000));
}
