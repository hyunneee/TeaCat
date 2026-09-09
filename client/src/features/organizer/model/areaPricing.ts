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
  /** 공연장에 등록된 구역의 형태. 공연이 바꿀 수 없습니다 */
  type: AreaType;
  /**
   * 이 공연에서 파는 방식. 좌석제 구역은 스탠딩으로도 팔 수 있지만(플로어에 의자를 두지 않는 경우)
   * 스탠딩 구역을 좌석제로 팔 수는 없습니다 — 배정할 좌석 좌표가 없기 때문입니다.
   */
  saleType: AreaType;
  /** 구역의 최대 수용 인원 */
  maxSeat: number;
  /** 배치도에 등록된 좌석 수. 좌석제로 팔 때의 기준입니다 */
  seatCount: number;
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
 * 파는 방식에 따른 정원. 좌석제면 배치도에 그려진 좌석 수, 스탠딩이면 구역의 최대 수용 인원입니다.
 * 좌석을 아직 안 그렸으면(0) 좌석제라도 최대 수용 인원을 씁니다.
 */
export function capacityOf(row: Pick<AreaPricingRow, 'saleType' | 'maxSeat' | 'seatCount'>): number {
  return row.saleType === 'SEATED' && row.seatCount > 0 ? row.seatCount : row.maxSeat;
}

/**
 * 좌석을 지정해 팔 수 있는 구역인지 — **좌석이 등록돼 있으면** 됩니다.
 *
 * 배치도에 좌석 행이 없으면 배정할 자리가 없어서, 켜 두면 회차 좌석 생성(API-269)이
 * 만들 좌석을 못 찾습니다(NO_SEATS_TO_GENERATE).
 */
export function canSellSeated(row: Pick<AreaPricingRow, 'seatCount'>): boolean {
  return row.seatCount > 0;
}

/**
 * 스탠딩으로 팔 수 있는 구역인지 — **의자가 없으면** 됩니다 (서버 PERFORMANCE_022 와 같은 규칙).
 *
 * 의자가 깔린 구역(`type === 'SEATED'`)은 그 의자가 자리에 그대로 있어서 사람을 세울 수 없습니다.
 * 의자를 치운 구성은 무대 형식(배치)을 따로 만들어 표현합니다.
 */
export function canSellStanding(row: Pick<AreaPricingRow, 'type'>): boolean {
  return row.type !== 'SEATED';
}

/**
 * 이 공연에서 고를 수 있는 판매 방식.
 *
 * 공연장이 구역을 등록할 때 좌석까지 그려 두면 둘 다 되고, 한쪽만 등록했으면 그 하나만 됩니다.
 * <pre>
 *   의자 있음 + 좌석 등록  →  좌석 지정만
 *   의자 없음 + 좌석 등록  →  둘 다 (전환 가능)
 *   의자 없음 + 좌석 없음  →  스탠딩만
 *   의자 있음 + 좌석 없음  →  없음 (팔 수 없는 구역)
 * </pre>
 */
export function sellableTypes(row: Pick<AreaPricingRow, 'type' | 'seatCount'>): AreaType[] {
  const types: AreaType[] = [];
  if (canSellSeated(row)) types.push('SEATED');
  if (canSellStanding(row)) types.push('STANDING');
  return types;
}

/** 팔 방법이 하나도 없는 구역. 판매를 켤 수 없습니다 */
export function isUnsellable(row: Pick<AreaPricingRow, 'type' | 'seatCount'>): boolean {
  return sellableTypes(row).length === 0;
}

/**
 * 바라는 방식이 가능하면 그대로, 아니면 가능한 하나로 바꿉니다.
 *
 * 팔 방법이 없는 구역은 바라는 값을 그대로 둡니다 — 어차피 판매를 켤 수 없고,
 * 여기서 값을 뒤집으면 화면에 왜 못 켜는지가 흐려집니다.
 */
export function pickSaleType(
  row: Pick<AreaPricingRow, 'type' | 'seatCount'>,
  wanted: AreaType,
): AreaType {
  const options = sellableTypes(row);
  if (options.length === 0 || options.includes(wanted)) return wanted;
  return options[0]!;
}

/**
 * 받을 인원 상한이 공연장 구역의 최대 수용 인원을 넘은 상태.
 *
 * 막지는 않습니다. 판매량(soldCnt)이 **회차 합산**이라 회차가 여러 개면 한 구역의 정원을
 * 넘는 게 정상이고(3회차 × 400명), 여기서 정원을 상한으로 걸면 "판매량보다 적게 못 줄임" 과
 * 충돌해 저장 자체가 막힙니다 (validateAreaRows 주석 참고). 그래서 경고만 띄웁니다.
 */
export function exceedsVenueCapacity(
  row: Pick<AreaPricingRow, 'enabled' | 'saleType' | 'maxCnt' | 'maxSeat'>,
): boolean {
  // 좌석제는 수량을 적지 않으니 넘을 일이 없습니다
  if (!row.enabled || row.saleType !== 'STANDING') return false;
  const maxCnt = Number(row.maxCnt);
  return Number.isInteger(maxCnt) && maxCnt > row.maxSeat;
}

/**
 * 파는 방식을 바꿀 때의 패치.
 *
 * 최대 수량이 이전 방식의 정원 그대로면(= 관리자가 손대지 않은 기본값) 새 방식의 정원으로 따라갑니다.
 * 직접 적어 넣은 값은 건드리지 않습니다.
 */
export function changeSaleType(row: AreaPricingRow, saleType: AreaType): Partial<AreaPricingRow> {
  const next = { ...row, saleType };
  if (row.maxCnt === String(capacityOf(row))) {
    return { saleType, maxCnt: String(capacityOf(next)) };
  }
  return { saleType };
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
    const capability = { type: area.type, seatCount: area.seatCount };
    const base = {
      areaId: area.areaId,
      label: areaLabel(area),
      type: area.type,
      /* 고를 수 있는 방식이 하나뿐이면 그걸로 자동 고정합니다.
         저장된 값이 지금 불가능해진 경우(좌석을 지운 뒤 등)도 여기서 바로잡습니다 */
      saleType: pickSaleType(capability, saved?.saleType ?? area.type),
      maxSeat: area.maxSeat,
      seatCount: area.seatCount,
    };
    return {
      ...base,
      enabled: !!saved,
      grade: saved?.grade ?? '',
      price: saved?.price != null ? String(saved.price) : '',
      maxCnt: saved?.maxCnt != null ? String(saved.maxCnt) : String(capacityOf(base)),
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
    /* 좌석도 없고 의자 때문에 스탠딩도 안 되면 팔 방법이 없습니다 */
    if (isUnsellable(row)) {
      return '좌석이 등록되지 않아 팔 수 없어요. 공연장 관리에서 좌석을 먼저 등록해 주세요.';
    }
    if (row.grade.length > GRADE_MAX_LENGTH) return `등급은 ${GRADE_MAX_LENGTH}자 이하여야 해요.`;
    if (row.saleType === 'STANDING' && !canSellStanding(row)) {
      return '의자가 설치된 구역은 스탠딩으로 팔 수 없어요.';
    }
    if (row.saleType === 'SEATED' && !canSellSeated(row)) {
      return '등록된 좌석이 없어 좌석을 지정해 팔 수 없어요.';
    }

    const price = toNonNegativeInt(row.price);
    if (price == null) return '가격을 0 이상 정수로 입력해 주세요.';

    /* 좌석제는 수량을 적지 않습니다 — 배치도에 등록된 좌석 행 수가 곧 팔 수 있는 티켓 수입니다.
       그 값을 화면에서 고치게 하면 좌석 수와 어긋나 어느 쪽이 진짜인지 알 수 없게 됩니다 */
    if (row.saleType === 'SEATED') return undefined;

    const maxCnt = toNonNegativeInt(row.maxCnt);
    if (maxCnt == null) return '받을 인원을 정수로 입력해 주세요.';
    /* 스탠딩은 좌석 행이 없어 이 값이 인원을 제한하는 유일한 근거입니다.
       비워 두면 무제한이 되므로 1명 이상을 받습니다 (서버 PERFORMANCE_024 와 같은 규칙) */
    if (maxCnt < 1) return '스탠딩으로 팔 구역은 받을 인원을 1명 이상으로 정해 주세요.';
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
      /* 좌석제는 수량을 보내지 않습니다 — 배치도의 좌석 행 수가 곧 팔 수 있는 티켓 수입니다.
         숫자를 함께 보내면 좌석 수와 어긋날 수 있고, 회차가 여러 개면 회차 합산 판매량이
         좌석 수를 넘어 "판매량보다 적게 못 줄임"(409)에 걸려 저장 자체가 막힙니다 */
      maxCnt: r.saleType === 'STANDING' ? Number(r.maxCnt) : null,
      saleType: r.saleType,
    }));
  return areas.length === 0 ? null : { areas };
}

export interface AreaSaveRequest {
  areas: {
    areaId: number;
    grade: string | null;
    price: number;
    /** 스탠딩은 받을 인원 상한(필수), 좌석제는 null — 좌석 행 수가 곧 상한입니다 */
    maxCnt: number | null;
    /** 생략하면 서버가 저장된 방식을 그대로 둡니다. 화면은 항상 채워 보냅니다 */
    saleType: AreaType;
  }[];
}
