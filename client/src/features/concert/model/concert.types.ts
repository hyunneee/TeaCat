/**
 * 서버 응답 그대로입니다 (`server/.../performance/dto/response`). 필드를 바꾸려면 서버부터 바꾸세요.
 *
 * ID 는 숫자로 옵니다. 라우트(`ROUTES.CONCERT_DETAIL`)는 문자열을 받으므로 넘길 때 `String()` 합니다.
 * 시각은 시간대 없는 ISO 문자열(`2026-10-01T20:00:00`)입니다 — 서버(KST) 기준 벽시계 시각입니다.
 */

/** 공연 진행 상태 (performance_general.status) */
export type ConcertStatus = 'UPCOMING' | 'ONGOING' | 'ENDED' | 'CANCELLED';

/** 회차 판매 상태 (performance_details.status) — 관리자가 정하는 값 */
export type ScheduleStatus = 'SCHEDULED' | 'OPEN' | 'SOLD_OUT' | 'CLOSED';

/** 서버가 현재 시각으로 계산한 예매 오픈 상태 */
export type BookingOpenStatus = 'BEFORE' | 'OPEN' | 'SOLDOUT' | 'CLOSED';

/** 공연 목록 항목 (API-201, API-207) */
export interface ConcertSummary {
  concertId: number;
  title: string;
  stadiumName: string;
  /** 티켓팅 오픈 시각 */
  ticketingStartAt: string;
  status: ConcertStatus;
  posterUrl: string | null;
  /** 비공개 상태. 클라이언트 목록에서는 항상 false, 등록자용 목록(/admin/concerts/mine)에서만 true 가 옵니다 */
  hidden: boolean;
}

/** 공연 목록 페이지 (API-201). 공용 CursorPage 와 달리 배열 키가 `concerts` 입니다 */
export interface ConcertListPage {
  concerts: ConcertSummary[];
  nextCursor: number | null;
  hasNext: boolean;
}

/** 회차 요약 (API-204, 공연 상세에 포함) */
export interface ScheduleSummary {
  scheduleId: number;
  performanceNum: number;
  /** 공연 일시 */
  performanceDate: string;
  status: ScheduleStatus;
  bookingStatus: BookingOpenStatus;
  /** 지금 예매할 수 있는가 — 서버가 판단한 값 */
  bookable: boolean;
}

export interface Stadium {
  stadiumId: number;
  name: string;
  address: string;
  phone: string | null;
}

export type AreaType = 'SEATED' | 'STANDING';

/** 이 공연에서 판매하는 구역의 등급·가격 (API-268 로 설정한 것). 설정하지 않은 구역은 목록에 없습니다 */
export interface PerformanceArea {
  areaId: number;
  areaCode: string;
  /** 공연장에 등록된 구역의 형태. 이 값은 공연이 바꿀 수 없습니다 */
  areaType: AreaType;
  /**
   * 이 공연에서 파는 방식. 좌석제 구역을 스탠딩으로 팔 수 있어(플로어에 의자를 두지 않는 경우)
   * `areaType` 과 다를 수 있습니다. 반대는 불가능합니다 — 스탠딩 구역에는 좌석 좌표가 없습니다.
   */
  saleType: AreaType;
  grade: string | null;
  price: number | null;
  /** 이 구역에서 팔 최대 수량. 회차 구분이 없는 안내값입니다 */
  maxCnt: number | null;
  /** 판매된 수량 — 공연 전체의 확정 티켓 수입니다 (회차 합산, 취소분 제외) */
  soldCnt: number;
}

/** 공연 상세 (API-202) */
export interface ConcertDetail {
  concertId: number;
  title: string;
  status: ConcertStatus;
  ticketingStartAt: string;
  visibleFrom: string;
  posterUrl: string | null;
  /** 상세 페이지 본문 이미지 (세로로 긴 한 장) */
  detailImageUrl: string | null;
  stadium: Stadium;
  schedules: ScheduleSummary[];
  /**
   * 구역별 등급·가격. **등록자용 상세(/admin/concerts/{id})에서만 채워집니다** — 수정 화면이 씁니다.
   * 관람객용 상세(API-202)는 항상 빈 배열이고, 가격이 필요하면 `GET /concerts/{id}/areas` 를 쓰세요.
   */
  areas: PerformanceArea[];
  /** 등록한 관리자의 userId. 서버는 이 사람에게만 수정·삭제를 허용합니다. 옛 데이터는 null */
  createdBy: number | null;
  /** 비공개 상태. 클라이언트 상세에서는 항상 false, 등록자용 상세(/admin/concerts/{id})에서만 true 가 옵니다 */
  hidden: boolean;
}

/** 회차 단건 (API-203) — 예매 플로우 헤더용 */
export interface ScheduleDetail {
  scheduleId: number;
  performanceNum: number;
  performanceDate: string;
  status: ScheduleStatus;
  bookingStatus: BookingOpenStatus;
  bookable: boolean;
  /** 취소 마감 — 공연 시작 시각 */
  cancelDeadlineAt: string;
  concertId: number;
  concertTitle: string;
  stadiumName: string;
  ticketingStartAt: string;
}
