import { parseServerTime } from '@/shared/lib';
import type { AdminPackEvent } from './adminPackEvent.types';

export const EVENT_CODE_MAX = 50;
export const EVENT_NAME_MAX = 100;

/**
 * 서버는 코드에 **영문 대문자·숫자·밑줄**만 받습니다(400).
 * 거절하지 말고 치는 대로 맞춰 줍니다 — 규칙을 외우게 할 이유가 없습니다.
 */
export function normalizeEventCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, EVENT_CODE_MAX);
}

/**
 * 왜 지금 안 나가는지.
 *
 * 🔴 `active` 만 보여주면 **"켰는데 왜 안 돼"** 가 남습니다. 스위치가 켜져 있어도
 * 시작 전이거나 끝났으면 지급되지 않습니다. 그 셋을 갈라서 알려줍니다.
 */
export type PackEventState = 'ongoing' | 'off' | 'before' | 'ended';

export function packEventState(event: AdminPackEvent, now = Date.now()): PackEventState {
  if (event.ongoing) return 'ongoing';
  if (!event.active) return 'off';
  if (event.startsAt && parseServerTime(event.startsAt) > now) return 'before';
  return 'ended';
}

/**
 * 지금 지급되는 이벤트.
 *
 * 진행 중인 것이 둘 이상이면 서버는 **가장 최근에 시작한 하나**만 씁니다.
 * 목록이 최신순이라 먼저 찾히는 것이 곧 그 하나입니다.
 */
export function ongoingEvent(events: AdminPackEvent[]): AdminPackEvent | undefined {
  return events.find((event) => event.ongoing);
}
