import type { Request, Response } from 'express';
import { z } from 'zod';
import { errors } from '../shared/errors';
import { burnCatMoney, getBalance, mintCatMoney } from '../services/catMoney.service';

/**
 * 컨트롤러는 요청 검증과 응답 변환만 합니다.
 *
 * 주의: 여기서 `.openapi()` 를 부르지 마세요. 그 메서드는 `docs/` 가 로드되면서
 *       zod 프로토타입에 붙는데, 컨트롤러는 라우터를 통해 **더 먼저** 로드됩니다.
 *       타입 확장은 전역이라 typecheck 는 통과하고, 서버는 기동에서 죽습니다.
 */

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const MAX_DERIVATION_INDEX = 2 ** 31 - 1;

/** 수량은 정수 문자열입니다. decimals=0 이고, JSON number 는 큰 값에서 정밀도가 깨집니다. */
const amount = z.string().regex(/^[1-9][0-9]*$/, '0 보다 큰 정수 문자열이어야 합니다');
const address = z.string().regex(ADDRESS, '0x + 40자리 hex 여야 합니다');

/** Spring 이 만드는 영구 유일 키. 서버가 keccak256 으로 해싱합니다. */
const operationKey = z.string().min(1).max(200);

export const balanceQuery = z.object({ address });

export const mintBody = z.object({
  operationKey,
  to: address,
  amount,
  /** 발행 사유. 온체인에는 남기지 않고 로그·대사용입니다 */
  reason: z.enum(['DEPOSIT', 'REWARD', 'REFUND']),
});

export const burnBody = z.object({
  operationKey,
  from: address,
  derivationIndex: z.number().int().min(0).max(MAX_DERIVATION_INDEX),
  amount,
  reason: z.enum(['PAYMENT', 'WITHDRAWAL']),
});

export async function getCatMoneyBalance(req: Request, res: Response): Promise<void> {
  const parsed = balanceQuery.safeParse(req.query);
  if (!parsed.success) {
    throw errors.badRequest('address 가 올바르지 않습니다', parsed.error.flatten());
  }
  res.status(200).json(await getBalance(parsed.data.address));
}

export async function postCatMoneyMint(req: Request, res: Response): Promise<void> {
  const parsed = mintBody.safeParse(req.body);
  if (!parsed.success) {
    throw errors.badRequest('요청 본문이 올바르지 않습니다', parsed.error.flatten());
  }

  const { operationKey: key, to, amount: value } = parsed.data;
  const result = await mintCatMoney(key, to, value);

  // 보냈으면 202, 이미 처리돼 있었으면 바뀐 게 없으니 200 입니다. (DESIGN.md 4-2)
  res.status(result.status === 'PENDING' ? 202 : 200).json(result);
}

export async function postCatMoneyBurn(req: Request, res: Response): Promise<void> {
  const parsed = burnBody.safeParse(req.body);
  if (!parsed.success) {
    throw errors.badRequest('요청 본문이 올바르지 않습니다', parsed.error.flatten());
  }

  const { operationKey: key, from, derivationIndex, amount: value } = parsed.data;
  const result = await burnCatMoney(key, from, derivationIndex, value);

  res.status(result.status === 'PENDING' ? 202 : 200).json(result);
}
