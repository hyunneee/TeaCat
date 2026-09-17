/**
 * 가상 대기실 (server/QUEUE_DESIGN.md).
 *
 * 티켓 오픈 때 좌석 페이지에 들어가는 인원을 서버가 정원(기본 5,000) 이하로 묶습니다.
 * 넘치는 사용자는 대기열에 서고, 서버가 1초마다 빈자리만큼 앞사람을 들여보냅니다.
 */

/** `GET /queue/{scheduleId}/status` · `POST /queue/{scheduleId}/enter` 응답 */
export interface QueueStatus {
  scheduleId: number;
  /** 이 회차가 대기실을 운영 중인지. false 면 admitted 는 항상 true 라 대기실을 건너뜁니다 */
  enabled: boolean;
  /** 좌석 페이지에 들어갈 수 있는지 */
  admitted: boolean;
  /** 내 순번(1부터). 입장했거나 대기실이 꺼져 있으면 null */
  position: number | null;
  /** 내 앞에 있는 인원 */
  waitingAhead: number | null;
  /** 예상 대기 초. 최근 60초 입장 속도로 계산. 아직 아무도 입장하지 않았으면 null */
  estimatedWaitSec: number | null;
  /** 적용 중인 정원 */
  capacity: number;
  /** 다음 상태 조회까지 기다릴 초. 대기 인원이 많으면 서버가 늘려 줍니다 */
  pollAfterSec: number;
}

/** 서버 오류 코드 (`QueueErrorCode`). 한 번 나간 코드는 바뀌지 않습니다 */
export const QUEUE_ERROR = {
  /** 428 — 대기실이 켜진 회차인데 입장 표식이 없다. 대기실로 보낸다 */
  NOT_ADMITTED: 'ERR_QUEUE_002',
  /** 409 — 대기실을 운영하지 않는 회차에 enter 를 불렀다 */
  DISABLED: 'ERR_QUEUE_003',
} as const;
