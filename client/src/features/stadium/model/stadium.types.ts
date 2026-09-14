export type StadiumAreaType = 'SEATED' | 'STANDING';
export type StadiumLayoutStatusValue = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type RowOrder = 'TOP_TO_BOTTOM' | 'BOTTOM_TO_TOP';
export type RowFormat = 'ALPHA' | 'HANGUL';
export type SeatOrder = 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT';
export type StadiumLayoutEditorTool =
  | 'draw-area'
  | 'resize-area'
  | 'split-area'
  | 'renumber-row'
  | 'pick-seats'
  | 'add-seat-range'
  | 'remove-seat-range'
  | 'draw-element';

export interface StadiumInfoDraft {
  name: string;
  address: string;
  phone: string;
  maxCapacity: string;
}

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/* ── 서버 응답 (Excel 분석) ─────────────────────────────── */

export interface StadiumCreateResponse {
  stadiumId: number;
  managedByRequester: boolean;
}

export interface StadiumSummary {
  stadiumId: number;
  name: string;
  address: string;
  phone: string | null;
  areaCount: number;
  maxCapacity: number;
}

export interface StadiumList {
  stadiums: StadiumSummary[];
}

export interface StadiumDetail extends StadiumSummary {
  layoutImageUrl: string | null;
  layoutWidth: number | null;
  layoutHeight: number | null;
}

export interface StadiumUpdateRequest {
  name?: string;
  address?: string;
  phone?: string;
  maxCapacity?: number;
}

export interface ExcelSheet {
  name: string;
  rowCount: number;
  columnCount: number;
}

export interface ExcelCandidate {
  candidateId: string;
  sheet: string;
  sourceType: string;
  shapeType: string;
  rawText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  styleFingerprint: string;
}

export interface ExcelAnalysis {
  analysisId: string;
  stadiumId: number;
  expiresIn: number;
  sheets: ExcelSheet[];
  seatCandidates: ExcelCandidate[];
  elementCandidates: ExcelCandidate[];
  warnings: string[];
}

/* ── 배치 확정 요청/응답 ────────────────────────────────── */

export interface DraftLabelingRule {
  rowOrder: RowOrder;
  rowFormat: RowFormat;
  startRowLabel: string;
  seatOrder: SeatOrder;
  startNumber: number;
}

export interface DraftManualSeat {
  clientId: string;
  sourceSheet: string;
  rowLabel: string;
  seatNumber: number;
  seatX: number;
  seatY: number;
}

export interface DraftArea {
  clientId: string;
  sourceSheet: string;
  levelCode: string;
  areaCode: string;
  type: StadiumAreaType;
  maxSeat: number;
  bounds: LayoutRect;
  acceptedCandidateIds: string[];
  manualSeats: DraftManualSeat[];
  labelingRule: DraftLabelingRule;
}

export interface DraftLayoutElement {
  clientId: string;
  sourceSheet: string;
  levelCode: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StadiumEditorDraftData {
  step: number;
  info: StadiumInfoDraft;
  stadiumId: number | null;
  analysis: ExcelAnalysis | null;
  analysisExpiresAt: number | null;
  selectedSheet: string | null;
  layoutName: string;
  isDefault: boolean;
  layoutWidth: number;
  layoutHeight: number;
  tool: StadiumLayoutEditorTool;
  areas: DraftArea[];
  unassignedSeats: DraftManualSeat[];
  selectedAreaId: string | null;
  layoutElements: DraftLayoutElement[];
  selectedElementId: string | null;
}

export interface CreatedSeat {
  seatId: number;
  rowLabel: string;
  seatNumber: number;
  candidateId: string | null;
}

export interface CreatedLayoutArea {
  areaId: number;
  areaCode: string;
  seats: CreatedSeat[];
}

export interface StadiumLayoutCreateResponse {
  layoutId: number;
  stadiumId: number;
  createdAreaCount: number;
  createdSeatCount: number;
  areas: CreatedLayoutArea[];
}

/* ── 배치 목록/상세 (등록 이후 조회) ─────────────────────── */

export interface StadiumLayoutSummary {
  layoutId: number;
  name: string;
  isDefault: boolean;
  status: StadiumLayoutStatusValue;
  layoutWidth: number;
  layoutHeight: number;
  areaCount: number;
  seatCount: number;
  standingCapacity: number;
  capacity: number;
}

export interface StadiumLayoutList {
  stadiumId: number;
  layouts: StadiumLayoutSummary[];
}

export interface StadiumLayoutUpdateRequest {
  name?: string;
  isDefault?: boolean;
  status?: StadiumLayoutStatusValue;
}

export interface StadiumLayoutDetail {
  layoutId: number;
  stadiumId: number;
  stadiumName: string;
  name: string;
  isDefault: boolean;
  status: StadiumLayoutStatusValue;
  layoutImageUrl: string | null;
  layoutWidth: number;
  layoutHeight: number;
  layoutElements: Record<string, unknown>[];
  areaCount: number;
  seatCount: number;
  standingCapacity: number;
  capacity: number;
}

export interface PersistedAreaSummary {
  areaId: number;
  levelCode: string;
  areaCode: string;
  type: StadiumAreaType;
  maxSeat: number;
  seatCount: number;
  areaX: number | null;
  areaY: number | null;
  width: number | null;
  height: number | null;
}

export interface PersistedAreaList {
  stadiumId: number;
  areas: PersistedAreaSummary[];
}

export interface PersistedSeat {
  seatId: number;
  rowLabel: string;
  seatNumber: number;
  seatX: number | null;
  seatY: number | null;
}

export interface PersistedSeatList {
  areaId: number;
  areaCode: string;
  type: StadiumAreaType;
  maxSeat: number;
  seatCount: number;
  seats: PersistedSeat[];
}
