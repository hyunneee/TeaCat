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
  /**
   * 서버가 회차를 합쳐 계산한 **대표 예매 상태**
   * (하나라도 열려 있으면 OPEN → BEFORE → SOLDOUT → CLOSED).
   *
   * 🔴 목록 칩은 이 값을 씁니다. `ticketingStartAt` 으로 직접 계산하면
   *    끝난 공연도 "예매중" 으로 보입니다 (`isConcertOpen` 주석 참고).
   */
  bookingStatus: BookingOpenStatus;
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
  /**
   * 취소표 대기를 받을 수 있는가 — **구역이 하나라도 매진**됐고 티켓팅이 열려 있으면 true.
   *
   * 회차 전체 매진(`bookingStatus === 'SOLDOUT'`)과 기준이 다릅니다. 대기는 구역 단위라
   * A구역만 팔려도 그 구역 대기는 받고, 반대로 모든 구역에 자리가 남아 있으면 받지 않습니다.
   */
  waitlistOpen: boolean;
}

/**
 * 예매 오픈 여부 확인 (API-206) — **예매 버튼을 누른 그 순간** 서버에 물어본 답.
 *
 * 화면은 오픈 전에도 버튼을 살려두고, 누르면 이걸로 확인합니다. 클라이언트 시계를
 * 앞당겨도 소용없고(판단은 서버), 폴링도 필요 없습니다(누를 때만 물어봅니다).
 * 진짜 방어선은 좌석 선점 API 라 이 확인은 안내를 위한 것입니다.
 */
export interface BookingOpenCheck {
  scheduleId: number;
  status: BookingOpenStatus;
  ticketingStartAt: string;
  /** 응답을 만든 시점의 서버 시각 */
  serverTime: string;
  /** 오픈까지 남은 초. 이미 열렸거나 끝났으면 0 */
  secondsUntilOpen: number;
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
  /**
   * "바로가기" 버튼이 갈 곳. 없으면 버튼을 그리지 않습니다.
   * 서비스 내 경로(`/nft/draw`)일 수도, 외부 주소(`https://…`)일 수도 있습니다 —
   * 어느 쪽인지는 `isExternalLink` 가 가릅니다 (`shared/lib/link`).
   */
  linkUrl: string | null;
  stadium: Stadium;
  schedules: ScheduleSummary[];
  /**
   * 구역별 등급·가격. **등록자용 상세(/admin/concerts/{id})에서만 채워집니다** — 수정 화면이 씁니다.
   * 관람객용 상세(API-202)는 항상 빈 배열이고, 가격이 필요하면 `GET /concerts/{id}/areas` 를 쓰세요.
   */
  areas: PerformanceArea[];
  /**
   * 이 공연이 쓰는 무대 형식(배치). 같은 공연장도 형식마다 구역이 다르게 나뉩니다.
   * 구역 목록은 **이 형식 기준**으로 불러와야 합니다 — 공연장 기준으로 불러오면
   * 기본 배치의 구역이 와서 저장이 거절됩니다 (PERFORMANCE_010).
   */
  layout: { layoutId: number; name: string };
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
  /** 취소표 대기를 받을 수 있는가. `ScheduleSummary.waitlistOpen` 과 같은 기준입니다 */
  waitlistOpen: boolean;
}

/**
 * 공연장 도면 위의 고정 요소 — 기둥·출입구·통로 같은 것들.
 *
 * `type` 은 정해진 목록이 아니라 운영자가 적는 값입니다 (`PILLAR`·`GATE`·`AISLE`·`STAGE` 관례).
 * 그래서 화면은 **모르는 타입도 그릴 수 있어야** 합니다 — 기본 모양으로 그리고 label 을 붙입니다.
 */
export interface LayoutElement {
  type: string;
  label?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 공연이 쓰는 무대 형식(배치도).
 *
 * 🔴 좌표는 이 배치도의 좌표계(`width` × `height`)입니다. 구역 `bounds` 도 같은 좌표계라
 *    둘을 같은 SVG 에 그대로 얹을 수 있습니다.
 */
export interface ConcertLayout {
  concertId: number;
  stadiumId: number;
  layoutId: number;
  layoutName: string;
  layoutImageUrl: string | null;
  width: number;
  height: number;
  /** 공연장 배치도에 원래 있는 것들 (기둥 등) */
  baseElements: LayoutElement[];
  /** 이 공연이 추가로 얹은 것들 */
  elements: LayoutElement[];
}
