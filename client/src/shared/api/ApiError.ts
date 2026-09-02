/**
 * 앱 전체에서 쓰는 단 하나의 에러 타입.
 *
 * axios 에러를 컴포넌트까지 그대로 흘려보내면 화면마다
 * `err.response?.data?.message ?? err.message ?? '...'` 를 반복하게 됩니다.
 * 인터셉터에서 전부 이 클래스로 변환해서 던집니다.
 */
export class ApiError extends Error {
  readonly status: number;
  /** 백엔드가 내려주는 비즈니스 에러 코드 */
  readonly code: string;
  readonly detail?: unknown;

  constructor(params: { status: number; code: string; message: string; detail?: unknown }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.detail = params.detail;
  }

  /** 네트워크 끊김 / 서버 미응답 */
  get isNetworkError() {
    return this.status === 0;
  }

  /** 재시도해도 의미 없는 에러 (400번대, 단 429 제외) */
  get isClientError() {
    return this.status >= 400 && this.status < 500 && this.status !== 429;
  }

  static isApiError(e: unknown): e is ApiError {
    return e instanceof ApiError;
  }
}

/** 화면에서 분기 처리할 일이 잦은 에러 코드 모음 */
export const ERROR_CODE = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FACE_NOT_REGISTERED: 'FACE_NOT_REGISTERED',
  SEAT_ALREADY_HELD: 'SEAT_ALREADY_HELD',
  SEAT_HOLD_EXPIRED: 'SEAT_HOLD_EXPIRED',
  PURCHASE_LIMIT_EXCEEDED: 'PURCHASE_LIMIT_EXCEEDED',
  DUPLICATE_REQUEST: 'DUPLICATE_REQUEST',
  NETWORK: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];
