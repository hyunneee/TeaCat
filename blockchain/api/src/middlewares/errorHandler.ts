import type { NextFunction, Request, Response } from 'express';
import { isAppError } from '../shared/errors';
import { logger } from '../shared/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `${req.method} ${req.path} 는 없는 경로입니다`,
  });
}

/**
 * 마지막 방어선.
 *
 * 체인 실패는 **정상 경로**입니다. revert 를 500 으로 던지지 말고
 * Spring 이 분기할 수 있는 코드로 내려줍니다. (DESIGN.md 7장)
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // Express 4 는 인자 4개를 보고 에러 핸들러로 인식합니다. next 를 지우면 안 됩니다.
  _next: NextFunction,
): void {
  if (isAppError(error)) {
    if (error.status >= 500) {
      logger.error(`${req.method} ${req.path} — ${error.code}`, error.detail);
    }

    res.status(error.status).json({
      code: error.code,
      message: error.message,
      ...(error.detail === undefined ? {} : { detail: error.detail }),
    });
    return;
  }

  // Express 는 경로·쿼리의 퍼센트 인코딩이 깨져 있으면 여기로 URIError 를 던집니다.
  // 클라이언트가 잘못 보낸 것이므로 500 이 아니라 400 입니다.
  if (error instanceof URIError) {
    res.status(400).json({
      code: 'BAD_REQUEST',
      message: 'URL 인코딩이 올바르지 않습니다 (UTF-8 로 인코딩해 보내세요)',
    });
    return;
  }

  logger.error(`${req.method} ${req.path} — 처리되지 않은 예외`, error);

  res.status(500).json({
    code: 'INTERNAL',
    message: '서버 내부 오류',
  });
}
