import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 는 async 핸들러가 던진 에러를 스스로 잡지 못합니다.
 * 감싸지 않으면 요청이 응답 없이 매달립니다.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
