import { http, newIdempotencyKey } from '@/shared/api';
import type {
  BookingPolicy,
  MyHold,
  Seat,
  SeatHold,
  SeatMapData,
  SeatStatus,
  Section,
} from '../model/booking.types';

/**
 * 예매 API — 서버와 만나는 유일한 지점.
 *
 * ── 서버 용어와 프론트 용어가 다릅니다 ───────────────────────────
 * 서버는 회차(`performance_details`)를 두 이름으로 부릅니다.
 *   `GET  /schedules/{scheduleId}`                                   조회 계열
 *   `POST /performance-details/{performanceDetailId}/seats/{id}/hold` 선점 계열
 * **같은 값**입니다. 그 혼란을 화면까지 옮기지 않으려고 이 파일에서만
 * 두 경로를 알고, 밖으로는 `scheduleId` 하나만 노출합니다.
 *
 * ── 응답을 그대로 쓰지 않는 이유 ────────────────────────────────
 * 서버는 구역을 `areaId/areaCode/areaX...`, 좌석을 `seatX/rowLabel...` 로 줍니다.
 * 화면 컴포넌트가 그 이름에 묶이면 서버 필드명이 바뀔 때 화면을 다 고쳐야 합니다.
 * 아래 어댑터가 경계에서 한 번만 옮깁니다.
 */

/* ── 서버 응답 형태 (여기서만 압니다) ───────────────────────── */

interface ApiSeat {
  seatId: number;
  rowLabel: string;
  seatNumber: number;
  seatX: number;
  seatY: number;
  status: SeatStatus;
}

interface ApiSeatArea {
  areaId: number;
  areaCode: string;
  type: string;
  grade: string | null;
  price: number | null;
  areaX: number;
  areaY: number;
  width: number;
  height: number;
  seatCount: number;
  availableCount: number;
  seats: ApiSeat[];
}

interface ApiSeatMap {
  scheduleId: number;
  serverTime: string;
  areas: ApiSeatArea[];
}

interface ApiSeatHold {
  performanceDetailId: number;
  seatId: number;
  status: SeatStatus;
  heldUntil: string;
  remainingSeconds: number;
}

interface ApiMyHold {
  performanceDetailId: number;
  seatId: number;
  heldUntil: string;
  remainingSeconds: number;
  performanceTitle: string;
  posterImg: string | null;
  performanceNum: number | null;
  performanceDate: string;
  stadiumName: string;
  areaCode: string;
  rowLabel: string;
  seatNumber: number;
  grade: string | null;
  price: number | null;
}

/* ── 어댑터 (서버 → 화면) ───────────────────────────────────── */

const toSection = (area: ApiSeatArea): Section => ({
  id: String(area.areaId),
  name: area.areaCode,
  grade: area.grade,
  price: area.price,
  totalSeats: area.seatCount,
  availableSeats: area.availableCount,
  /* 서버는 "좌석이 준비됐는지" 를 따로 알려주지 않습니다. 회차 좌석을 만들지 않았으면
     전 좌석이 BLOCKED 로 오므로, BLOCKED 가 아닌 좌석을 세어 그걸 구분합니다.
     (안 세면 아직 열지도 않은 구역이 "매진" 으로 보입니다 — sellableSeats 주석 참고) */
  sellableSeats: area.seats.filter((seat) => seat.status !== 'BLOCKED').length,
  bounds: { x: area.areaX, y: area.areaY, width: area.width, height: area.height },
});

const toSeat = (area: ApiSeatArea) => (seat: ApiSeat): Seat => ({
  id: String(seat.seatId),
  sectionId: String(area.areaId),
  row: seat.rowLabel,
  number: seat.seatNumber,
  // 좌석 가격은 구역에서 내려옵니다 (좌석별 가격 개념이 서버에 없습니다)
  price: area.price,
  status: seat.status,
  x: seat.seatX,
  y: seat.seatY,
});

function toSeatMap(api: ApiSeatMap): SeatMapData {
  return {
    scheduleId: String(api.scheduleId),
    serverTime: api.serverTime,
    sections: api.areas.map(toSection),
    // 구역별로 묶여 온 좌석을 한 배열로 폅니다. 좌석맵은 한 장이라 구역 경계가 없습니다
    seats: api.areas.flatMap((area) => area.seats.map(toSeat(area))),
  };
}

const toSeatHold = (api: ApiSeatHold): SeatHold => ({
  scheduleId: String(api.performanceDetailId),
  seatId: String(api.seatId),
  status: api.status,
  expiresAt: api.heldUntil,
  remainingSeconds: api.remainingSeconds,
});

const toMyHold = (api: ApiMyHold): MyHold => ({
  scheduleId: String(api.performanceDetailId),
  seatId: String(api.seatId),
  expiresAt: api.heldUntil,
  remainingSeconds: api.remainingSeconds,
  concertTitle: api.performanceTitle,
  posterUrl: api.posterImg,
  performanceNum: api.performanceNum,
  performanceDate: api.performanceDate,
  stadiumName: api.stadiumName,
  sectionName: api.areaCode,
  row: api.rowLabel,
  number: api.seatNumber,
  grade: api.grade,
  price: api.price,
});

/* ── 호출 ───────────────────────────────────────────────────── */

/** 선점 계열만 쓰는 경로. 조회 계열의 /schedules 와 같은 ID 입니다 */
const holdPath = (scheduleId: string, seatId: string) =>
  `/performance-details/${scheduleId}/seats/${seatId}/hold`;

export const bookingApi = {
  /**
   * 회차 좌석 현황 — 구역(등급·가격·좌표) + 좌석(좌표·상태)을 한 번에.
   *
   * 구역 선택 화면과 좌석 선택 화면이 **같은 응답**을 씁니다. 구역만 따로
   * 받아오면 두 화면 사이에서 잔여 좌석 수가 어긋나 보입니다.
   */
  seatMap: (scheduleId: string) =>
    http.get<ApiSeatMap>(`/schedules/${scheduleId}/seats`).then(toSeatMap),

  /** 1인 최대 매수 등 예매 정책. 회차가 아니라 공연 단위입니다 */
  policy: (concertId: string) => http.get<BookingPolicy>(`/concerts/${concertId}/policy`),

  /**
   * 좌석 선점. 동시 요청 중 한 명만 성공하고 나머지는 실패합니다.
   *
   * 진짜 락은 서버가 잡습니다 — `performance_seats` 를 조건부 UPDATE 해서
   * 영향 행이 0이면 이미 남이 잡은 것입니다. 프론트는 실패를 곱게 처리할 뿐입니다.
   */
  hold: (scheduleId: string, seatId: string) =>
    http
      .post<ApiSeatHold>(holdPath(scheduleId, seatId), undefined, {
        // 더블클릭·재시도로 요청이 두 번 나가도 서버가 한 번만 처리하도록
        idempotencyKey: newIdempotencyKey(),
      })
      .then(toSeatHold),

  releaseHold: (scheduleId: string, seatId: string) =>
    http.delete<void>(holdPath(scheduleId, seatId)),

  /** 내가 선점 중인 좌석. 결제 화면 진입점입니다 */
  myHolds: () => http.get<ApiMyHold[]>('/me/holds').then((list) => list.map(toMyHold)),
};

export const bookingKeys = {
  all: ['booking'] as const,
  seatMap: (scheduleId: string) => [...bookingKeys.all, 'seatMap', scheduleId] as const,
  policy: (concertId: string) => [...bookingKeys.all, 'policy', concertId] as const,
  myHolds: () => [...bookingKeys.all, 'myHolds'] as const,
};
