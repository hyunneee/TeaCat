import type { AreaType, PerformanceArea } from '@/features/concert';

/**
 * 구역별 등급·가격 설정 모델 (API-268 `PUT /admin/concerts/{id}/areas`).
 *
 * 공연장의 구역 목록(API-253)을 바탕으로 한 줄씩 "이 공연에서 팔 것인지, 얼마에, 몇 장까지" 를 정합니다.
 * PUT 이라 보낸 목록이 전체가 됩니다 — 체크를 끈 구역은 서버에서 지워집니다(판매하지 않음).
 */

/** 공연장 구역 (API-253 응답 항목 중 화면이 쓰는 것) */
export interface StadiumArea {
  areaId: number;
  /** 층 코드 — 없을 수 있습니다 */
  levelCode: string | null;
  areaCode: string;
  type: AreaType;
  /** 최대 수용 인원 */
  maxSeat: number;
  /** 배치도에 등록된 좌석 수 (좌석제만 의미 있음) */
  seatCount: number;
}

export interface StadiumAreaListResponse {
  stadiumId: number;
  areas: StadiumArea[];
}

/** 편집 중인 구역 한 줄. 입력 요소 값이라 숫자도 문자열로 듭니다 */
export interface AreaPricingRow {
  areaId: number;
  /** 화면 표기 — "2F A" 처럼 층과 구역 코드 */
  label: string;
  type: AreaType;
  /** 좌석제는 등록 좌석 수, 스탠딩은 최대 수용 인원 */
  capacity: number;
  /** 이 공연에서 판매할지 */
  enabled: boolean;
  grade: string;
  price: string;
  maxCnt: string;
  /**
   * 이미 팔린 수량 — **공연 전체의 확정 티켓 수**입니다(회차 합산, 취소분 제외). 회차별 수치가 아닙니다.
   * 이보다 적게 줄이거나 판매를 끌 수 없습니다(AREA_MAX_CNT_BELOW_SOLD, 409).
   */
  soldCnt: number;
}

export const GRADE_MAX_LENGTH = 20;

export function areaLabel(area: Pick<StadiumArea, 'levelCode' | 'areaCode'>): string {
  return area.levelCode ? `${area.levelCode} ${area.areaCode}` : area.areaCode;
}

/**
 * 공연장 구역 목록과 (있다면) 이미 저장된 설정을 합쳐 편집 줄을 만듭니다.
 * 저장된 구역은 체크된 상태로 값이 채워지고, 나머지는 꺼진 상태로 기본값(최대 수량 = 수용 인원)입니다.
 */
export function buildAreaRows(
  stadiumAreas: StadiumArea[],
  existing: PerformanceArea[] = [],
): AreaPricingRow[] {
  const byId = new Map(existing.map((a) => [a.areaId, a]));

  return stadiumAreas.map((area) => {
    const saved = byId.get(area.areaId);
    // 좌석제는 배치도에 등록된 좌석 수가 상한이지만, 좌석을 아직 안 그렸으면(0) 구역의 최대 수용 인원을 쓴다
    const capacity = area.type === 'SEATED' && area.seatCount > 0 ? area.seatCount : area.maxSeat;
    return {
      areaId: area.areaId,
      label: areaLabel(area),
      type: area.type,
      capacity,
      enabled: !!saved,
      grade: saved?.grade ?? '',
      price: saved?.price != null ? String(saved.price) : '',
      maxCnt: saved?.maxCnt != null ? String(saved.maxCnt) : String(capacity),
      soldCnt: saved?.soldCnt ?? 0,
    };
  });
}

function toNonNegativeInt(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  return Number(value);
}

/**
 * 줄마다의 에러. 인덱스는 rows 와 같고, 문제 없으면 undefined 입니다.
 * 서버 규칙(가격·수량 0 이상, 등급 20자, 판매량보다 적게 못 줄임)을 미리 검사합니다 — 서버도 다시 검사합니다.
 */
export function validateAreaRows(rows: AreaPricingRow[]): (string | undefined)[] {
  return rows.map((row) => {
    if (!row.enabled) {
      return row.soldCnt > 0 ? '이미 판매된 구역은 판매를 끌 수 없어요.' : undefined;
    }
    if (row.grade.length > GRADE_MAX_LENGTH) return `등급은 ${GRADE_MAX_LENGTH}자 이하여야 해요.`;

    const price = toNonNegativeInt(row.price);
    if (price == null) return '가격을 0 이상 정수로 입력해 주세요.';

    const maxCnt = toNonNegativeInt(row.maxCnt);
    if (maxCnt == null) return '최대 판매수량을 0 이상 정수로 입력해 주세요.';
    if (maxCnt < row.soldCnt) {
      return `전 회차 합계로 이미 ${row.soldCnt}장 팔려서 그보다 적게 줄일 수 없어요.`;
    }

    /* 좌석 수를 상한으로 걸지 않습니다.
       판매량(soldCnt)은 **공연 전체(회차 합산)** 인데 최대 수량은 회차 구분이 없는 안내값이라,
       회차가 둘 이상이면 판매량이 한 구역의 좌석 수를 넘을 수 있습니다. 그때 좌석 수를 상한으로 걸면
       "판매량보다 적게 못 줄임" 과 "좌석 수보다 많이 못 팖" 이 동시에 걸려 저장 자체가 막힙니다.
       서버도 판매량 조건만 봅니다. 좌석 수는 줄에 그대로 보여주니 판단은 관리자에게 맡깁니다. */
    return undefined;
  });
}

export function hasEnabledArea(rows: AreaPricingRow[]): boolean {
  return rows.some((r) => r.enabled);
}

/** 서버 요청 본문 (API-268). 켜진 구역만 담고, 하나도 없으면 null — PUT 은 빈 목록을 받지 않습니다 */
export function toAreaSaveRequest(rows: AreaPricingRow[]): AreaSaveRequest | null {
  const areas = rows
    .filter((r) => r.enabled)
    .map((r) => ({
      areaId: r.areaId,
      grade: r.grade.trim() || null,
      price: Number(r.price),
      maxCnt: Number(r.maxCnt),
    }));
  return areas.length === 0 ? null : { areas };
}

export interface AreaSaveRequest {
  areas: { areaId: number; grade: string | null; price: number; maxCnt: number }[];
}
