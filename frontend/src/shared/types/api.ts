/** 백엔드와 합의한 공통 응답 봉투. 팀 회의에서 확정되면 여기만 고치면 됩니다. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  /** 비즈니스 에러 코드 (예: 'SEAT_ALREADY_HELD') */
  code?: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

export interface OffsetPage<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiErrorBody {
  code?: string;
  message?: string;
}
