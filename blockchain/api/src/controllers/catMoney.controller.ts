import type { Request, Response } from 'express';
import { z } from 'zod';
import { errors } from '../shared/errors';
import {
  burnCatMoney,
  getBalance,
  mintCatMoney,
  transferCatMoney,
} from '../services/catMoney.service';

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

/**
 * Spring 이 만드는 영구 유일 키. 서버가 keccak256 으로 해싱해 온체인에 넣습니다.
 *
 * 주의: **비밀값을 넣으면 안 됩니다.** 해시가 체인에 영구히 남습니다.
 *       주문번호·티켓 PK 같은 식별자를 쓰세요.
 */
const operationKey = z.string().min(1).max(200);

export const balanceQuery = z.object({ address });

export const mintBody = z.object({
  operationKey,
  /**
   * 받는 주소. **반드시 `POST /internal/wallets` 가 만들어준 파생 지갑이어야 합니다.**
   *
   * 외부 지갑(개인 MetaMask 등)에 발행하면 그 캣머니는 영원히 회수할 수 없습니다 —
   * 소각은 유저 본인의 서명이 필요한데 서버는 그 키를 모르고, 컨트랙트에 `burnFrom`
   * 도 없어서 admin 이라도 못 태웁니다.
   *
   * 여기서 검사하지는 못합니다. 파생 인덱스를 전부 훑어볼 수 없기 때문입니다.
   * Spring 이 자기 DB 의 주소만 보내야 합니다.
   */
  to: address,
  amount,
  /** 발행 사유. 온체인에는 남기지 않고 로그·대사용입니다 */
  reason: z.enum(['DEPOSIT', 'REWARD', 'REFUND', 'ADMIN_GRANT']),
});

export const burnBody = z.object({
  operationKey,
  from: address,
  derivationIndex: z.number().int().min(0).max(MAX_DERIVATION_INDEX),
  amount,
  reason: z.enum(['PAYMENT', 'WITHDRAWAL', 'ADMIN_BURN']),
});

/**
 * 포카 마켓 정산 — 유저 → 유저.
 *
 * 발행·소각과 달리 `reason` 이 없습니다. 캣머니 전송은 마켓 정산 하나뿐이고,
 * 어느 거래였는지는 `tradeId` 가 이미 말해줍니다.
 */
export const transferBody = z.object({
  operationKey,
  from: address,
  derivationIndex: z.number().int().min(0).max(MAX_DERIVATION_INDEX),
  to: address,
  amount,
  /** `nft_photocard_trades.id`. 온체인에는 안 남고 로그 추적용입니다 */
  tradeId: z.string().min(1).max(200),
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

  const { operationKey: key, to, amount: value, reason } = parsed.data;
  const result = await mintCatMoney(key, to, value, reason);

  // 보냈으면 202, 이미 처리돼 있었으면 바뀐 게 없으니 200 입니다. (DESIGN.md 4-2)
  res.status(result.status === 'PENDING' ? 202 : 200).json(result);
}

export async function postCatMoneyBurn(req: Request, res: Response): Promise<void> {
  const parsed = burnBody.safeParse(req.body);
  if (!parsed.success) {
    throw errors.badRequest('요청 본문이 올바르지 않습니다', parsed.error.flatten());
  }

  const { operationKey: key, from, derivationIndex, amount: value, reason } = parsed.data;
  const result = await burnCatMoney(key, from, derivationIndex, value, reason);

  res.status(result.status === 'PENDING' ? 202 : 200).json(result);
}

export async function postCatMoneyTransfer(req: Request, res: Response): Promise<void> {
  const parsed = transferBody.safeParse(req.body);
  if (!parsed.success) {
    throw errors.badRequest('요청 본문이 올바르지 않습니다', parsed.error.flatten());
  }

  const { operationKey: key, from, derivationIndex, to, amount: value, tradeId } = parsed.data;
  const result = await transferCatMoney(key, from, derivationIndex, to, value, tradeId);

  res.status(result.status === 'PENDING' ? 202 : 200).json(result);
}
