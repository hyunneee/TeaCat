import type { Request, Response } from 'express';
import { z } from 'zod';
import { errors } from '../shared/errors';
import { resolveWallet } from '../services/wallet.service';

/**
 * 요청 본문 스키마.
 *
 * `docs/openapi.ts` 가 **이 객체를 그대로** 문서로 변환합니다.
 * 문서용으로 따로 베끼지 않으므로 검증과 문서가 어긋날 수 없습니다.
 */
export const createWalletBody = z.object({
  /**
   * Spring 이 발급한 파생 인덱스. auto-increment 로 뽑고 **절대 재사용하지 않습니다.**
   * (DESIGN.md 5-1)
   */
  derivationIndex: z.number().int().min(0),
});

export function createWallet(req: Request, res: Response): void {
  const parsed = createWalletBody.safeParse(req.body);

  if (!parsed.success) {
    throw errors.badRequest('요청 본문이 올바르지 않습니다', parsed.error.flatten());
  }

  res.status(200).json(resolveWallet(parsed.data.derivationIndex));
}
