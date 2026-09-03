import type { NextFunction, Request, Response } from 'express';
import { logger } from '../shared/logger';

/**
 * 요청 한 줄 로깅.
 *
 * 주의: **본문을 통째로 찍지 않습니다.** 지금은 니모닉이 요청에 실릴 일이 없지만,
 * 그런 미들웨어가 한번 생기면 나중에 누가 무엇을 실어 보낼지 알 수 없습니다.
 * (DESIGN.md 5-1 — 로그 유출)
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });

  next();
}
