/** 취소표 추첨 대기 상태 */
export type ResaleStatus =
  | 'WAITING' // 추첨 대기 중
  | 'WON' // 당첨 — 기한 내 결제해야 함
  | 'PURCHASED' // 당첨 좌석을 결제해 티켓을 받음
  | 'LOST' // 미당첨 — 회차의 취소 마감이 지나 더 이상 취소표가 나올 수 없음
  | 'EXPIRED'; // 당첨됐지만 기한 초과

export interface ResaleSection {
  sectionId: string;
  name: string;
  grade: string;
  price: number;
  /** 현재 이 구역 대기 인원 */
  waitingCount: number;
  /** 이 구역이 매진됐는가. 취소표 대기는 매진된 구역에만 걸 수 있습니다 — 남은 자리가 있으면 그냥 예매하면 됩니다 */
  soldOut: boolean;
}

export interface ResaleEntry {
  id: string;
  scheduleId: string;
  sectionId: string;
  sectionName: string;
  grade: string;
  price: number;
  quantity: number;
  status: ResaleStatus;
  /** 당첨 시 결제 마감 시각 (12시간) */
  deadlineAt: string | null;
  createdAt: string;

  concertTitle: string;
  artist: string;
  posterSeed: string;
  startAt: string;

  /** 당첨 좌석. 당첨 전이면 null. 좌석은 이미 내 선점(HELD)으로 잡혀 있어 예매 확인 화면으로 바로 간다 */
  seatId?: string | null;
  /** 당첨을 결정한 온체인 추첨 키. 탐색기에서 DrawOpened/DrawRevealed 이벤트를 찾는 열쇠 */
  drawKey?: string | null;
  /** 체인에서 확정된 난수. 참가자 목록과 함께 순위를 누구나 다시 계산할 수 있다 */
  randomness?: string | null;
}

export interface DrawResult extends ResaleEntry {
  /** NRF 가 만들어낸 검증 가능한 난수 */
  randomness: string;
}

export interface ApplyResaleRequest {
  sectionId: string;
  quantity: number;
}
