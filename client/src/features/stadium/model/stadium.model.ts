import type {
  DraftArea,
  DraftLabelingRule,
  DraftLayoutElement,
  ExcelAnalysis,
  ExcelCandidate,
  LayoutPoint,
  LayoutRect,
  StadiumInfoDraft,
  StadiumLayoutStatusValue,
} from './stadium.types';

export const STADIUM_LAYOUT_STATUS_LABEL: Record<StadiumLayoutStatusValue, string> = {
  DRAFT: '작성 중',
  ACTIVE: '사용 가능',
  ARCHIVED: '보관됨',
};

export function nextAreaCode(index: number): string {
  return `AREA-${index + 1}`;
}

export function defaultLabelingRule(): DraftLabelingRule {
  return {
    rowOrder: 'TOP_TO_BOTTOM',
    rowFormat: 'ALPHA',
    startRowLabel: 'A',
    seatOrder: 'LEFT_TO_RIGHT',
    startNumber: 1,
  };
}

export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): LayoutRect {
  return {
    x: roundCoordinate(Math.min(startX, endX)),
    y: roundCoordinate(Math.min(startY, endY)),
    width: roundCoordinate(Math.abs(endX - startX)),
    height: roundCoordinate(Math.abs(endY - startY)),
  };
}

export function isInsideRect(point: LayoutPoint, rect: LayoutRect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function candidateCenter(candidate: ExcelCandidate): LayoutPoint {
  return { x: candidate.x + candidate.width / 2, y: candidate.y + candidate.height / 2 };
}

/**
 * Excel에서 실제 좌석일 가능성이 높은 후보만 자동 선택합니다.
 * 모든 테두리 셀을 좌석으로 간주하지 않고 좌석 라벨, 반복된 채움 셀,
 * 반복된 좌석 도형을 사용합니다. 나머지 셀도 화면에는 남아 수동 검수가 가능합니다.
 */
export function detectAutomaticSeatCandidateIds(candidates: ExcelCandidate[]): Set<string> {
  const fingerprintCounts = new Map<string, number>();
  for (const candidate of candidates) {
    fingerprintCounts.set(
      candidate.styleFingerprint,
      (fingerprintCounts.get(candidate.styleFingerprint) ?? 0) + 1,
    );
  }

  return new Set(
    candidates
      .filter((candidate) => {
        const hasText = candidate.rawText.trim().length > 0;
        if (looksLikeSeatLabel(candidate.rawText)) return true;
        if (hasText) return false;
        const repeated = (fingerprintCounts.get(candidate.styleFingerprint) ?? 0) >= 2;
        if (candidate.sourceType.toUpperCase() === 'CELL') {
          const aspectRatio =
            Math.max(candidate.width, candidate.height) /
            Math.max(1, Math.min(candidate.width, candidate.height));
          return repeated && aspectRatio <= 2.5 && candidate.styleFingerprint.endsWith(':FILL');
        }
        const shapeType = candidate.shapeType.toUpperCase();
        return (
          repeated &&
          (shapeType === 'ELLIPSE' ||
            shapeType === 'CIRCLE' ||
            shapeType === 'RECTANGLE' ||
            shapeType === 'ROUNDED_RECTANGLE' ||
            shapeType === 'DIAMOND')
        );
      })
      .map((candidate) => candidate.candidateId),
  );
}

function looksLikeSeatLabel(rawText: string): boolean {
  const text = rawText.trim();
  if (!text || text.length > 20) return false;
  return (
    /^\d{1,5}$/.test(text) ||
    /^[A-Za-z가-힣]{1,4}\s*[-_]?\s*\d{1,5}$/.test(text) ||
    /^[A-Za-z가-힣]{1,4}\s*열\s*\d{1,5}\s*번?$/.test(text)
  );
}

/**
 * 저장된 좌석은 셀 크기 정보 없이 중심 좌표만 남습니다. 레이아웃 전체에서
 * 좌석 간 최근접 거리의 중앙값을 하나의 "좌석 피치"로 삼습니다. 구역마다 간격을
 * 따로 추측하면 밀도가 다른 구역끼리 좌석 크기가 달라지고 서로 겹칩니다.
 *
 * 좌석 수가 많을 때를 대비해 최대 400개 지점만 표본으로 뽑아 최근접 거리를 재고,
 * 각 표본은 전체 좌석과 비교합니다(표본 400 × 전체 n).
 */
export function computeSeatPitch(
  areas: DraftArea[],
  additionalSeats: { seatX: number; seatY: number }[] = [],
): number {
  const points = [
    ...areas.flatMap((area) => area.manualSeats.map((seat) => ({ x: seat.seatX, y: seat.seatY }))),
    ...additionalSeats.map((seat) => ({ x: seat.seatX, y: seat.seatY })),
  ];
  if (points.length < 2) return 16;

  const stride = Math.max(1, Math.floor(points.length / Math.min(points.length, 400)));
  const nearest: number[] = [];
  for (let i = 0; i < points.length; i += stride) {
    const probe = points[i];
    if (!probe) continue;
    let min = Infinity;
    for (let j = 0; j < points.length; j += 1) {
      if (j === i) continue;
      const other = points[j];
      if (!other) continue;
      const distance = Math.hypot(probe.x - other.x, probe.y - other.y);
      if (distance > 0.5 && distance < min) min = distance;
    }
    if (Number.isFinite(min)) nearest.push(min);
  }
  if (nearest.length === 0) return 16;
  nearest.sort((left, right) => left - right);
  return nearest[Math.floor(nearest.length / 2)] ?? 16;
}

/** 저장 좌표만 있는 기존 좌석을 공유 좌석 피치로 같은 크기 사각형에 배치합니다. */
export function inferManualSeatRects(
  area: Pick<DraftArea, 'manualSeats'>,
  seatPitch: number,
): Map<string, LayoutRect> {
  if (area.manualSeats.length === 0) return new Map();
  const size = Math.max(5, seatPitch * 0.8);
  return new Map(
    area.manualSeats.map((seat) => [
      seat.clientId,
      {
        x: seat.seatX - size / 2,
        y: seat.seatY - size / 2,
        width: size,
        height: size,
      },
    ]),
  );
}

/** 클릭 지점 근처의 후보를 찾습니다. 후보 사각형이 작을수록 우선합니다. */
export function findCandidateAtPoint(
  candidates: ExcelCandidate[],
  point: LayoutPoint,
  _tolerance: number,
): ExcelCandidate | null {
  let best: ExcelCandidate | null = null;
  for (const candidate of candidates) {
    // Excel 셀은 서로 맞닿아 있으므로 클릭 영역을 임의로 확장하면 옆 칸이
    // 선택될 수 있다. 화면에 그린 실제 셀/도형 경계 안에서만 선택한다.
    if (!isInsideRect(point, candidate)) continue;
    if (!best || candidate.width * candidate.height < best.width * best.height) best = candidate;
  }
  return best;
}

export function computeLayoutSize(candidates: ExcelCandidate[]): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  for (const candidate of candidates) {
    maxX = Math.max(maxX, candidate.x + candidate.width);
    maxY = Math.max(maxY, candidate.y + candidate.height);
  }
  return { width: Math.max(1, Math.ceil(maxX + 20)), height: Math.max(1, Math.ceil(maxY + 20)) };
}

/**
 * Excel 원본을 별도 이미지 렌더러로 캡처하지 않고, 이미 분석한 좌표·도형·텍스트를
 * 잠긴 배경 요소로 보존합니다. 좌석으로 자동 판정된 셀은 실제 좌석 레이어가 그리므로
 * 중복 저장하지 않고, 무대·출입구 등의 요소와 좌석이 아닌 텍스트 셀만 남깁니다.
 */
/**
 * 서버가 구역 좌표를 주지 않았을 때(레거시·구역 CRUD로 만든 배치), 그 구역 좌석들의
 * 바운딩 박스에 여백을 더해 구역 사각형을 복원합니다. 좌석이 없으면 fallback 위치에
 * 작은 박스를 둬 "좌표 없음"을 눈에 띄게 남깁니다.
 */
export function deriveAreaBounds(
  seats: { seatX: number; seatY: number }[],
  fallbackOrigin: LayoutPoint,
): LayoutRect {
  if (seats.length === 0) {
    return {
      x: Math.max(0, fallbackOrigin.x),
      y: Math.max(0, fallbackOrigin.y),
      width: 10,
      height: 10,
    };
  }
  const xs = seats.map((seat) => seat.seatX);
  const ys = seats.map((seat) => seat.seatY);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const padX = Math.max(6, (maxX - minX) * 0.06);
  const padY = Math.max(6, (maxY - minY) * 0.06);
  return {
    x: roundCoordinate(Math.max(0, minX - padX)),
    y: roundCoordinate(Math.max(0, minY - padY)),
    width: roundCoordinate(maxX - minX + padX * 2),
    height: roundCoordinate(maxY - minY + padY * 2),
  };
}

/**
 * 구역·좌석·고정 요소가 실제로 차지하는 최대 범위. 서버가 준 배치 크기가 이보다
 * 작거나 비정상이면 이 값으로 대체해 캔버스가 잘리거나 세로로 찌그러지는 것을 막습니다.
 */
export function computeLayoutExtent(
  areas: DraftArea[],
  elements: DraftLayoutElement[],
): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  for (const area of areas) {
    maxX = Math.max(maxX, area.bounds.x + area.bounds.width);
    maxY = Math.max(maxY, area.bounds.y + area.bounds.height);
    for (const seat of area.manualSeats) {
      maxX = Math.max(maxX, seat.seatX);
      maxY = Math.max(maxY, seat.seatY);
    }
  }
  for (const element of elements) {
    maxX = Math.max(maxX, element.x + element.width);
    maxY = Math.max(maxY, element.y + element.height);
  }
  return { width: Math.max(1, Math.ceil(maxX + 20)), height: Math.max(1, Math.ceil(maxY + 20)) };
}

export function acceptedSeatCount(area: DraftArea): number {
  return area.acceptedCandidateIds.length + area.manualSeats.length;
}

export interface SeatLabelPreview {
  candidateId: string;
  rowLabel: string;
  seatNumber: number;
  label: string;
}

/** 서버의 행 그룹화·라벨 생성 규칙과 같은 방식으로 자동 좌석 라벨을 미리 계산합니다. */
export function buildSeatLabelPreview(
  area: DraftArea,
  candidates: ExcelCandidate[],
): SeatLabelPreview[] {
  const accepted = new Set(area.acceptedCandidateIds);
  const selected = candidates
    .filter((candidate) => accepted.has(candidate.candidateId))
    .sort((left, right) => left.y - right.y || left.x - right.x);
  const rows: ExcelCandidate[][] = [];

  for (const candidate of selected) {
    const last = rows.at(-1);
    if (!last) {
      rows.push([candidate]);
      continue;
    }
    const referenceY = last.reduce((sum, item) => sum + item.y, 0) / last.length;
    const tolerance = Math.max(4, candidate.height * 0.7);
    if (Math.abs(candidate.y - referenceY) <= tolerance) last.push(candidate);
    else rows.push([candidate]);
  }

  if (area.labelingRule.rowOrder === 'BOTTOM_TO_TOP') rows.reverse();

  return rows.flatMap((row, rowIndex) => {
    row.sort((left, right) => left.x - right.x);
    if (area.labelingRule.seatOrder === 'RIGHT_TO_LEFT') row.reverse();
    const startRowIndex = parseStartRowIndex(
      area.labelingRule.startRowLabel,
      area.labelingRule.rowFormat,
    );
    const rowLabel =
      area.labelingRule.rowFormat === 'HANGUL'
        ? hangulLabel(startRowIndex + rowIndex)
        : alphaLabel(startRowIndex + rowIndex);
    return row.map((candidate, seatIndex) => {
      const seatNumber = area.labelingRule.startNumber + seatIndex;
      return {
        candidateId: candidate.candidateId,
        rowLabel,
        seatNumber,
        label: `${rowLabel}-${seatNumber}`,
      };
    });
  });
}

const HANGUL_ROW_ALPHABET = '가나다라마바사아자차카타파하';

function parseStartRowIndex(label: string, format: DraftLabelingRule['rowFormat']): number {
  if (format === 'HANGUL') {
    const normalized = label.trim();
    if (!isValidHangulRowLabel(normalized)) return 0;
    let value = 0;
    for (const character of normalized)
      value = value * 14 + HANGUL_ROW_ALPHABET.indexOf(character) + 1;
    return value - 1;
  }
  const normalized = label.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) return 0;
  let value = 0;
  for (const character of normalized) value = value * 26 + character.charCodeAt(0) - 64;
  return value - 1;
}

export function isValidHangulRowLabel(label: string): boolean {
  return (
    label.length > 0 && [...label].every((character) => HANGUL_ROW_ALPHABET.includes(character))
  );
}

function alphaLabel(index: number): string {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function hangulLabel(index: number): string {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = HANGUL_ROW_ALPHABET[value % HANGUL_ROW_ALPHABET.length] + result;
    value = Math.floor(value / HANGUL_ROW_ALPHABET.length);
  }
  return result;
}

export function validateStadiumInfo(info: StadiumInfoDraft): string | null {
  if (!info.name.trim()) return '공연장 이름을 입력해 주세요.';
  if (!info.address.trim()) return '공연장 주소를 입력해 주세요.';
  return null;
}

export function validateAreasDraft(areas: DraftArea[]): string | null {
  if (areas.length === 0) return '구역을 한 개 이상 지정해 주세요.';
  const codes = new Set<string>();
  for (const area of areas) {
    const code = area.areaCode.trim();
    if (!code) return '모든 구역에 구역 코드를 입력해 주세요.';
    const scopedCode = `${area.levelCode}#${code}`;
    if (codes.has(scopedCode)) return `${area.levelCode}의 구역 코드 ${code}가 중복되었습니다.`;
    codes.add(scopedCode);
    if (area.type === 'SEATED' && acceptedSeatCount(area) === 0) {
      return `${code} 구역에 좌석을 한 개 이상 지정해 주세요.`;
    }
    if (area.type === 'SEATED') {
      const startRow = area.labelingRule.startRowLabel.trim();
      const validStartRow =
        area.labelingRule.rowFormat === 'HANGUL'
          ? isValidHangulRowLabel(startRow)
          : /^[A-Za-z]+$/.test(startRow);
      if (!validStartRow) return `${code} 구역의 시작 행 라벨을 확인해 주세요.`;
      const manualLabels = new Set<string>();
      for (const seat of area.manualSeats) {
        if (!seat.rowLabel.trim()) return `${code} 구역의 수동 좌석 행 라벨을 입력해 주세요.`;
        const label = `${seat.rowLabel.trim()}#${seat.seatNumber}`;
        if (manualLabels.has(label)) return `${code} 구역에 중복된 수동 좌석 라벨이 있습니다.`;
        manualLabels.add(label);
      }
    }
    if (area.type === 'STANDING' && area.maxSeat < 1) {
      return `${code} 구역의 수용 인원을 입력해 주세요.`;
    }
  }
  return null;
}

export type LayoutDraftIssueCode =
  | 'LAYOUT_SIZE'
  | 'AREA_REQUIRED'
  | 'AREA_CODE'
  | 'AREA_CODE_DUPLICATE'
  | 'AREA_BOUNDS'
  | 'AREA_EMPTY'
  | 'ROW_LABEL'
  | 'CANDIDATE_NOT_FOUND'
  | 'CANDIDATE_SHEET'
  | 'CANDIDATE_DUPLICATE'
  | 'CANDIDATE_OUTSIDE_AREA'
  | 'MANUAL_SEAT_OUTSIDE_AREA'
  | 'SEAT_LABEL_DUPLICATE'
  | 'STANDING_CAPACITY'
  | 'ELEMENT_TYPE'
  | 'ELEMENT_BOUNDS';

export interface LayoutDraftValidationIssue {
  code: LayoutDraftIssueCode;
  message: string;
  areaId?: string;
  elementId?: string;
  sourceSheet?: string;
}

/**
 * 서버의 배치 저장 검사를 편집 단계에서 먼저 수행합니다.
 * 오류에는 구역/요소와 층 정보를 포함해 사용자가 문제가 난 위치로 바로 이동할 수 있습니다.
 */
export function validateLayoutDraft(
  areas: DraftArea[],
  layoutElements: DraftLayoutElement[],
  analysis: ExcelAnalysis | null,
  layoutWidth: number,
  layoutHeight: number,
): LayoutDraftValidationIssue[] {
  const issues: LayoutDraftValidationIssue[] = [];
  const validLayoutSize =
    Number.isFinite(layoutWidth) &&
    Number.isFinite(layoutHeight) &&
    layoutWidth > 0 &&
    layoutHeight > 0;
  if (!validLayoutSize) {
    issues.push({ code: 'LAYOUT_SIZE', message: '배치의 전체 너비와 높이가 올바르지 않습니다.' });
  }
  if (areas.length === 0) {
    issues.push({ code: 'AREA_REQUIRED', message: '구역을 한 개 이상 지정해 주세요.' });
    return issues;
  }

  const candidates = analysis?.seatCandidates ?? [];
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const candidateOwner = new Map<string, DraftArea>();
  const areaCodes = new Set<string>();

  for (const area of areas) {
    const areaName = area.areaCode.trim() || '(코드 없음)';
    const addAreaIssue = (code: LayoutDraftIssueCode, message: string) => {
      if (issues.some((issue) => issue.areaId === area.clientId && issue.code === code)) return;
      issues.push({
        code,
        message: `${area.levelCode} · ${areaName}: ${message}`,
        areaId: area.clientId,
        sourceSheet: area.sourceSheet,
      });
    };

    const code = area.areaCode.trim();
    if (!code) addAreaIssue('AREA_CODE', '구역 코드를 입력해 주세요.');
    else {
      const scopedCode = `${area.levelCode}#${code}`;
      if (areaCodes.has(scopedCode))
        addAreaIssue('AREA_CODE_DUPLICATE', '중복된 구역 코드입니다.');
      areaCodes.add(scopedCode);
    }

    const bounds = area.bounds;
    const validBounds =
      [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) &&
      bounds.x >= 0 &&
      bounds.y >= 0 &&
      bounds.width > 0 &&
      bounds.height > 0 &&
      (!validLayoutSize ||
        (bounds.x + bounds.width <= layoutWidth && bounds.y + bounds.height <= layoutHeight));
    if (!validBounds) {
      addAreaIssue(
        'AREA_BOUNDS',
        `구역 좌표(${bounds.x}, ${bounds.y}, ${bounds.width}×${bounds.height})가 ` +
          `배치 범위(${layoutWidth}×${layoutHeight})를 벗어났습니다.`,
      );
    }

    if (area.type === 'STANDING') {
      if (!Number.isFinite(area.maxSeat) || area.maxSeat < 1) {
        addAreaIssue('STANDING_CAPACITY', '수용 인원을 1명 이상 입력해 주세요.');
      }
      continue;
    }

    if (acceptedSeatCount(area) === 0)
      addAreaIssue('AREA_EMPTY', '좌석을 한 개 이상 지정해 주세요.');
    const startRow = area.labelingRule.startRowLabel.trim();
    const validStartRow =
      area.labelingRule.rowFormat === 'HANGUL'
        ? isValidHangulRowLabel(startRow)
        : /^[A-Za-z]+$/.test(startRow);
    if (!validStartRow) addAreaIssue('ROW_LABEL', '시작 행 라벨을 확인해 주세요.');

    const selectedCandidates: ExcelCandidate[] = [];
    for (const candidateId of area.acceptedCandidateIds) {
      const candidate = candidateById.get(candidateId);
      if (!candidate) {
        addAreaIssue(
          'CANDIDATE_NOT_FOUND',
          `좌석 후보 ${candidateId}를 Excel 분석 결과에서 찾을 수 없습니다.`,
        );
        continue;
      }
      selectedCandidates.push(candidate);
      if (candidate.sheet !== area.sourceSheet) {
        addAreaIssue(
          'CANDIDATE_SHEET',
          `좌석 후보가 ${candidate.sheet} 시트에 있어 현재 층과 일치하지 않습니다.`,
        );
      }
      const previousOwner = candidateOwner.get(candidateId);
      if (previousOwner && previousOwner.clientId !== area.clientId) {
        addAreaIssue(
          'CANDIDATE_DUPLICATE',
          `${previousOwner.areaCode} 구역과 같은 좌석 후보를 사용하고 있습니다.`,
        );
      } else candidateOwner.set(candidateId, area);
      if (!isInsideRect(candidateCenter(candidate), bounds)) {
        addAreaIssue(
          'CANDIDATE_OUTSIDE_AREA',
          `선택 좌석 ${candidate.rawText || candidateId}의 중심점이 구역 밖에 있습니다.`,
        );
      }
    }

    const labels = new Set(
      buildSeatLabelPreview(area, selectedCandidates).map(
        (seat) => `${seat.rowLabel}#${seat.seatNumber}`,
      ),
    );
    for (const seat of area.manualSeats) {
      if (
        !Number.isFinite(seat.seatX) ||
        !Number.isFinite(seat.seatY) ||
        !isInsideRect({ x: seat.seatX, y: seat.seatY }, bounds)
      ) {
        addAreaIssue(
          'MANUAL_SEAT_OUTSIDE_AREA',
          `${seat.rowLabel}-${seat.seatNumber} 좌석 좌표가 구역 밖에 있습니다.`,
        );
      }
      const label = `${seat.rowLabel.trim()}#${seat.seatNumber}`;
      if (!seat.rowLabel.trim() || labels.has(label)) {
        addAreaIssue(
          'SEAT_LABEL_DUPLICATE',
          `${seat.rowLabel || '(행 없음)'}-${seat.seatNumber} 좌석 라벨이 비었거나 중복되었습니다.`,
        );
      }
      labels.add(label);
    }
  }

  for (const element of layoutElements) {
    const addElementIssue = (code: LayoutDraftIssueCode, message: string) => {
      if (issues.some((issue) => issue.elementId === element.clientId && issue.code === code))
        return;
      issues.push({
        code,
        message: `${element.levelCode} · ${element.label || '(이름 없음)'}: ${message}`,
        elementId: element.clientId,
        sourceSheet: element.sourceSheet,
      });
    };
    if (!element.type.trim()) addElementIssue('ELEMENT_TYPE', '고정 요소 종류를 입력해 주세요.');
    const validBounds =
      [element.x, element.y, element.width, element.height].every(Number.isFinite) &&
      element.x >= 0 &&
      element.y >= 0 &&
      element.width >= 0 &&
      element.height >= 0 &&
      (!validLayoutSize ||
        (element.x + element.width <= layoutWidth && element.y + element.height <= layoutHeight));
    if (!validBounds)
      addElementIssue('ELEMENT_BOUNDS', '고정 요소 좌표가 배치 범위를 벗어났습니다.');
  }

  return issues;
}

export function toLayoutImportAreaPayload(area: DraftArea) {
  return {
    sourceSheet: area.sourceSheet,
    levelCode: area.levelCode,
    areaCode: area.areaCode.trim(),
    type: area.type,
    maxSeat: area.type === 'STANDING' ? area.maxSeat : null,
    bounds: {
      x: area.bounds.x,
      y: area.bounds.y,
      width: area.bounds.width,
      height: area.bounds.height,
    },
    acceptedCandidateIds: area.type === 'SEATED' ? area.acceptedCandidateIds : [],
    manualSeats:
      area.type === 'SEATED'
        ? area.manualSeats.map((seat) => ({
            rowLabel: seat.rowLabel.trim(),
            seatNumber: seat.seatNumber,
            seatX: seat.seatX,
            seatY: seat.seatY,
          }))
        : [],
    labelingRule: area.type === 'SEATED' ? area.labelingRule : null,
  };
}

export function toLayoutElementPayload(element: DraftLayoutElement) {
  return {
    sourceSheet: element.sourceSheet,
    levelCode: element.levelCode,
    type: element.type,
    shape: 'RECT',
    label: element.label.trim(),
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: 0,
    points: [],
    zIndex: 1,
  };
}
