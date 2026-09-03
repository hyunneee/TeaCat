import type { Request, Response } from 'express';
import { z } from 'zod';
import { errors } from '../shared/errors';
import { resolveWallet } from '../services/wallet.service';

/**
 * BIP-32 비강화 파생 인덱스의 상한.
 * 이 값을 넘으면 강화(hardened) 영역이라 경로가 달라집니다.
 */
const MAX_DERIVATION_INDEX = 2 ** 31 - 1;

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
  derivationIndex: z.number().int().min(0).max(MAX_DERIVATION_INDEX),

  /**
   * 가입 시 넣어줄 캣머니. **금액은 Spring 이 정합니다.**
   *
   * 정수 문자열입니다 — `decimals = 0` 이라 소수가 없고, JSON number 로 받으면
   * 큰 값에서 정밀도가 깨집니다.
   * 없으면 주소만 계산하고 발행하지 않습니다.
   */
  seedAmount: z
    .string()
    .regex(/^[1-9][0-9]*$/, '0 보다 큰 정수 문자열이어야 합니다')
    .optional(),
});

/**
 * 컨트롤러는 요청 검증과 응답 변환만 합니다.
 * 도메인 판단은 `services/`, 체인 접근은 `chain/` 입니다.
 */
export async function createWallet(req: Request, res: Response): Promise<void> {
  const parsed = createWalletBody.safeParse(req.body);

  if (!parsed.success) {
    throw errors.badRequest('요청 본문이 올바르지 않습니다', parsed.error.flatten());
  }

  const wallet = await resolveWallet(parsed.data.derivationIndex, parsed.data.seedAmount);

  // 트랜잭션을 보냈으면 202 입니다. 확정은 Spring 이 txHash 로 확인합니다. (DESIGN.md 4-2)
  // 주소만 계산했으면 바뀐 게 없으므로 200 입니다.
  res.status(wallet.seed?.status === 'PENDING' ? 202 : 200).json(wallet);
}
