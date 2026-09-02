/**
 * 도메인 에러.
 *
 * 체인의 revert 를 500 으로 던지지 않습니다. Spring 이 분기할 수 있는
 * **코드**로 변환해서 내려줍니다. (DESIGN.md 7장)
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errors = {
  badRequest: (message: string, detail?: unknown) =>
    new AppError('BAD_REQUEST', message, 400, detail),

  unauthorized: (message = '내부 인증에 실패했습니다') =>
    new AppError('UNAUTHORIZED', message, 401),

  notFound: (message: string) => new AppError('NOT_FOUND', message, 404),

  /** 체인에 붙지 못했을 때. Spring 은 재시도해도 됩니다. */
  chainUnavailable: (detail?: unknown) =>
    new AppError('CHAIN_UNAVAILABLE', '체인에 연결할 수 없습니다', 503, detail),

  internal: (message = '알 수 없는 오류') => new AppError('INTERNAL', message, 500),
};

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
