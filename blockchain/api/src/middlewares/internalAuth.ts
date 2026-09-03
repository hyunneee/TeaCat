import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config';
import { errors } from '../shared/errors';

const HEADER = 'x-internal-key';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // 길이가 다르면 timingSafeEqual 이 던집니다. 길이 비교부터 합니다.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Spring ↔ 이 서비스 사이의 S2S 인증.
 *
 * 이 프로세스는 오퍼레이터 개인키와 마스터 니모닉을 쥐고 있습니다.
 * 브라우저에서 직접 닿을 수 있는 경로가 하나라도 있으면 안 됩니다. (DESIGN.md 1장)
 */
export function internalAuth(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.header(HEADER);

  if (!provided || !safeEqual(provided, env.INTERNAL_API_KEY)) {
    throw errors.unauthorized();
  }

  next();
}
