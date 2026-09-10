import type { NextFunction, Request, Response } from 'express';
import { logger } from '../shared/logger';
import { httpDuration } from '../metrics';

/**
 * 요청 한 줄 로깅 + 응답 시간 지표.
 *
 * 주의: **본문을 통째로 찍지 않습니다.** 지금은 니모닉이 요청에 실릴 일이 없지만,
 * 그런 미들웨어가 한번 생기면 나중에 누가 무엇을 실어 보낼지 알 수 없습니다.
 * (DESIGN.md 5-1 — 로그 유출)
 *
 * 지표를 여기에 붙인 이유는 **이미 시간을 재고 있었기 때문**입니다. 같은 값을 두 번 재는
 * 미들웨어를 늘릴 이유가 없습니다.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on('finish', () => {
    const elapsedMs = Date.now() - startedAt;

    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs}ms`);

    httpDuration.observe(
      {
        method: req.method,
        route: routePattern(req),
        status: String(res.statusCode),
      },
      elapsedMs / 1000,
    );
  });

  next();
}

/**
 * 지표 라벨에 쓸 경로. **실제 URL 이 아니라 라우트 패턴입니다.**
 *
 * 🔴 `req.originalUrl` 을 그대로 넣으면 `/internal/tickets/by-key?key=...` 처럼 값마다
 *    다른 문자열이 되어 티켓 수만큼 시계열이 생깁니다. Prometheus 메모리가 그대로 터지는
 *    전형적인 사고라, 매칭된 패턴(`/tickets/:id`)만 씁니다.
 *
 * 라우트에 매칭되지 않은 요청(404)은 전부 하나로 묶습니다 — 존재하지 않는 주소는
 * 무한히 다양할 수 있어 그 자체가 카디널리티 위험입니다.
 */
function routePattern(req: Request): string {
  const path = req.route?.path;
  if (typeof path !== 'string') {
    return 'unmatched';
  }
  return `${req.baseUrl ?? ''}${path}` || '/';
}
