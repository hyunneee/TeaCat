import type { Request, Response } from 'express';
import { z } from 'zod';
import { errors } from '../shared/errors';
import { reportTx } from '../services/tx.service';

/**
 * 경로 파라미터 스키마.
 * `docs/openapi.ts` 가 이 객체를 그대로 문서로 변환합니다.
 *
 * 주의: 여기서 `.openapi()` 를 부르지 마세요. 그 메서드는 `docs/` 가 로드되면서
 *       zod 프로토타입에 붙는데, 컨트롤러는 라우터를 통해 **더 먼저** 로드됩니다.
 *       타입 확장은 전역이라 typecheck 는 통과하고, 서버는 기동에서 죽습니다.
 *       예시·설명은 `docs/` 쪽에서 붙입니다.
 */
export const txParams = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, '0x + 64자리 hex 여야 합니다'),
});

export async function getTx(req: Request, res: Response): Promise<void> {
  const parsed = txParams.safeParse(req.params);

  if (!parsed.success) {
    throw errors.badRequest('txHash 형식이 올바르지 않습니다', parsed.error.flatten());
  }

  // 체인이 실패를 알려준 것도 200 입니다. 조회 자체는 성공했으니까요. (DESIGN.md 7장)
  res.status(200).json(await reportTx(parsed.data.txHash));
}
