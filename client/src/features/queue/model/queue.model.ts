import type { QueueStatus } from './queue.types';

/** 서버가 준 폴링 간격(초)을 ms 로. 서버가 0 을 주거나 값이 없으면 최소 2초 */
export function nextPollMs(status: QueueStatus | undefined): number | false {
  if (!status || !status.enabled || status.admitted) return false;
  return Math.max(status.pollAfterSec, 2) * 1000;
}

/**
 * 예상 대기 시간 문구.
 *
 * 초 단위 그대로 보여주면 매 폴링마다 숫자가 튀어 불안해 보입니다.
 * 분 단위로 뭉개고, 1분 미만은 "곧" 으로 씁니다.
 */
export function estimatedWaitLabel(sec: number | null, waitingAhead: number | null = null): string {
  // 앞에 아무도 없으면 속도를 몰라도 다음 차례다. 서버도 0 을 주지만 옛 응답을 대비해 화면도 같은 판단을 한다
  if (waitingAhead === 0) return '곧 입장';
  if (sec == null) return '계산 중';
  if (sec < 60) return '곧 입장';
  const min = Math.ceil(sec / 60);
  if (min < 60) return `약 ${min}분`;
  const hour = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `약 ${hour}시간` : `약 ${hour}시간 ${rest}분`;
}
