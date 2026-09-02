/** 취소표 추첨 대기 상태 */
export type ResaleStatus =
  | 'WAITING' // 추첨 대기 중
  | 'WON' // 당첨 — 기한 내 결제해야 함
  | 'LOST' // 미당첨
  | 'EXPIRED'; // 당첨됐지만 기한 초과

export interface ResaleSection {
  sectionId: string;
  name: string;
  grade: string;
  price: number;
  /** 현재 이 구역 대기 인원 */
  waitingCount: number;
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
}

export interface DrawResult extends ResaleEntry {
  /** NRF 가 만들어낸 검증 가능한 난수 */
  randomness: string;
}

export interface ApplyResaleRequest {
  sectionId: string;
  quantity: number;
}
