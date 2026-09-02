export interface ConcertSummary {
  id: string;
  title: string;
  artist: string;
  /** 포스터가 없을 때 그라데이션을 만드는 시드 */
  posterSeed: string;
  posterUrl?: string | null;
  genre: string;
  venueName: string;
  /** 예매 오픈 시각 */
  openAt: string;
  firstShowAt: string | null;
  lastShowAt: string | null;
  /** 아직 예매 오픈 전이면 true */
  upcoming: boolean;
}

export type ScheduleStatus = 'UPCOMING' | 'OPEN' | 'SOLD_OUT' | 'CLOSED';

export interface ScheduleSummary {
  id: string;
  startAt: string;
  openAt: string;
  maxPerUser: number;
  availableSeats: number;
  totalSeats: number;
  status: ScheduleStatus;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
}

export interface ConcertDetail extends ConcertSummary {
  runningMinutes: number;
  ageLimit: string;
  description: string;
  venue: Venue | null;
  schedules: ScheduleSummary[];
}

/** 예매 플로우 헤더에 쓰는 회차 정보 */
export interface ScheduleDetail {
  id: string;
  startAt: string;
  maxPerUser: number;
  concertId: string;
  concertTitle: string;
  artist: string;
  posterSeed: string;
  venueName: string;
  sectionCount: number;
}
