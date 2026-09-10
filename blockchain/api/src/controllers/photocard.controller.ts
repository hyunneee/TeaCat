import type { Request, Response } from 'express';
import { z } from 'zod';
import { errors } from '../shared/errors';
import {
  findPhotocardByKey,
  getPhotocardBalance,
  issuePhotocards,
  registerPhotocardDesign,
  transferPhotocard,
} from '../services/photocard.service';

/**
 * 컨트롤러는 요청 검증과 응답 변환만 합니다.
 *
 * 주의: 여기서 `.openapi()` 를 부르지 마세요. 그 메서드는 `docs/` 가 로드되면서
 *       zod 프로토타입에 붙는데, 컨트롤러는 라우터를 통해 **더 먼저** 로드됩니다.
 *       타입 확장은 전역이라 typecheck 는 통과하고, 서버는 기동에서 죽습니다.
 */

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const MAX_DERIVATION_INDEX = 2 ** 31 - 1;

const address = z.string().regex(ADDRESS, '0x + 40자리 hex 여야 합니다');

/**
 * `nft_photocard_designs.id` — **그대로 온체인 tokenId 입니다.**
 *
 * 문자열로 받는 이유는 Postgres `bigint` 라 JSON number 로 주고받으면 큰 값에서
 * 정밀도가 깨지기 때문입니다. 0 은 없습니다 — 컨트랙트가 "미등록" 자리로 비워둡니다.
 */
const designId = z.string().regex(/^[1-9][0-9]{0,77}$/, '1 이상의 정수 문자열이어야 합니다');

const positiveAmount = z.string().regex(/^[1-9][0-9]{0,77}$/, '0 보다 큰 정수 문자열이어야 합니다');

/**
 * `nft_photocards.id`. 카드 한 장의 영구 유일 키입니다.
 *
 * 이 값 하나가 **한 티켓에 카드 두 장이 나가는 것**을 막습니다 — 응답이 끊겨
 * Spring 이 재시도해도 컨트랙트가 건너뜁니다. (DESIGN.md 4-3)
 *
 * 주의: **비밀값을 넣으면 안 됩니다.** 해시가 체인에 영구히 남습니다.
 */
const photocardKey = z.string().min(1).max(200);

/**
 * Pinata 에 핀한 **메타데이터 JSON** 의 CID. 이미지 CID 가 아닙니다.
 *
 * `ipfs://` 는 서버가 붙입니다. 이미지 CID 를 보내면 지갑이 JSON 대신 이미지
 * 바이트를 파싱하려 들어 카드가 이름도 없이 깨져 보입니다.
 */
const metadataCid = z.string().min(1).max(200);

export const designBody = z.object({ designId, maxSupply: positiveAmount, metadataCid });

/**
 * 상한은 컨트랙트의 `MAX_BATCH` 와 맞춥니다. 서비스가 체인에서 읽어 한 번 더 봅니다 —
 * 여기 숫자는 **명백히 큰 요청을 일찍 끊기 위한** 것입니다.
 */
export const issueBody = z.object({
  items: z
    .array(z.object({ photocardKey, designId, to: address }))
    .min(1)
    .max(200),
});

export const photocardKeyQuery = z.object({ key: photocardKey });

export const balanceQuery = z.object({ address, designId });

/**
 * 마켓 정산 — 판매자 → 구매자.
 *
 * `operationKey` 는 거래 PK 등 Spring 이 만드는 영구 유일 키입니다. 발행 키와는
 * 이름공간이 갈려 있어(`OP_ISSUE` / `OP_TRANSFER`) 서로를 막지 못합니다.
 *
 * 주의: **비밀값을 넣으면 안 됩니다.** 해시가 체인에 영구히 남습니다.
 */
export const transferBody = z.object({
  operationKey: z.string().min(1).max(200),
  from: address,
  /** **판매자의** 파생 인덱스. 이 키로 서명합니다 */
  derivationIndex: z.number().int().min(0).max(MAX_DERIVATION_INDEX),
  to: address,
  designId,
  /** 마켓 거래는 항상 `"1"` 이지만 컨트랙트가 ERC-1155 라 수량을 받습니다 */
  amount: positiveAmount,
  /** `nft_photocard_trades.id`. 온체인에는 안 남고 로그 추적용입니다 */
  tradeId: z.string().min(1).max(200),
});

export async function postPhotocardDesign(req: Request, res: Response): Promise<void> {
  const parsed = designBody.safeParse(req.body);
  if (!parsed.success) {
    throw errors.badRequest('요청 본문이 올바르지 않습니다', parsed.error.flatten());
  }

  const result = await registerPhotocardDesign(
    BigInt(parsed.data.designId),
    BigInt(parsed.data.maxSupply),
    parsed.data.metadataCid,
  );

  // 보냈으면 202, 이미 같은 값으로 등록돼 있었으면 바뀐 게 없으니 200 입니다.
  res.status(result.status === 'PENDING' ? 202 : 200).json(result);
}

export async function postPhotocardIssue(req: Request, res: Response): Promise<void> {
  const parsed = issueBody.safeParse(req.body);
  if (!parsed.success) {
    throw errors.badRequest('요청 본문이 올바르지 않습니다', parsed.error.flatten());
  }

  res.status(202).json(await issuePhotocards(parsed.data.items));
}

export async function getPhotocardByKey(req: Request, res: Response): Promise<void> {
  const parsed = photocardKeyQuery.safeParse(req.query);
  if (!parsed.success) {
    throw errors.badRequest('key 가 올바르지 않습니다', parsed.error.flatten());
  }

  // 발행 전이어도 200 입니다. 404 로 만들면 "아직 안 됨" 과 "경로가 틀림" 이 섞입니다.
  res.status(200).json(await findPhotocardByKey(parsed.data.key));
}

export async function getPhotocardBalanceOf(req: Request, res: Response): Promise<void> {
  const parsed = balanceQuery.safeParse(req.query);
  if (!parsed.success) {
    throw errors.badRequest('조회 조건이 올바르지 않습니다', parsed.error.flatten());
  }

  res
    .status(200)
    .json(await getPhotocardBalance(parsed.data.address, BigInt(parsed.data.designId)));
}

export async function postPhotocardTransfer(req: Request, res: Response): Promise<void> {
  const parsed = transferBody.safeParse(req.body);
  if (!parsed.success) {
    throw errors.badRequest('요청 본문이 올바르지 않습니다', parsed.error.flatten());
  }

  const { operationKey, from, derivationIndex, to, designId, amount, tradeId } = parsed.data;
  const result = await transferPhotocard(
    operationKey,
    from,
    derivationIndex,
    to,
    BigInt(designId),
    BigInt(amount),
    tradeId,
  );

  res.status(result.status === 'PENDING' ? 202 : 200).json(result);
}
