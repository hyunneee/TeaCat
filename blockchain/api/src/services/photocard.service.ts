import {
  balanceOf,
  getDesign,
  isIssued,
  isIssuePaused,
  issueBatch,
  maxBatch,
  metadataUriOf,
  photocardNftAddress,
  registerDesign,
  type IssueItem,
} from '../chain/contracts/photocardNft';
import { normalizeAddress } from '../chain/address';
import { errors } from '../shared/errors';
import { logger, short } from '../shared/logger';
import { watchIssueBatch } from './photocardConfirm.service';

/**
 * 포토카드 유스케이스. (PHOTOCARD_PLAN.md 3장)
 *
 * **`tokenId` 는 카드 한 장이 아니라 도안입니다.** 체인이 답하는 질문은
 * "이 사람이 이 도안을 몇 장 갖고 있나" 하나입니다. 좌석·공연·소유자 닉네임은
 * Spring 의 DB 가 소유합니다 (DESIGN.md 1장).
 */

export interface DesignRegisterResult {
  /** 방금 보냈으면 PENDING, 같은 값으로 이미 등록돼 있으면 ALREADY_DONE */
  status: 'PENDING' | 'ALREADY_DONE';
  txHash: string | null;
  designId: string;
  maxSupply: string;
  metadataUri: string;
}

export interface IssueBatchResult {
  status: 'PENDING';
  txHash: string;
  count: number;
}

export interface PhotocardLookupResult {
  issued: boolean;
}

export interface PhotocardBalanceResult {
  address: string;
  designId: string;
  balance: string;
  totalSupply: string;
  maxSupply: string;
}

export interface IssueRequestItem {
  photocardKey: string;
  designId: string;
  to: string;
}

/** 컨트랙트가 배포돼 있는지. 없으면 여기서 멈춥니다 — 조용히 넘기면 안 됩니다. */
function requireDeployed(): void {
  if (photocardNftAddress() === null) throw errors.contractUnavailable('PhotocardNFT');
}

/**
 * 도안 등록 — 한정 수량과 IPFS 메타데이터를 체인에 못 박습니다.
 *
 * **발행보다 먼저입니다.** 등록되지 않은 도안이 배치에 섞이면 배치 전체가 revert 됩니다.
 *
 * 같은 값으로 다시 오면 새 트랜잭션을 보내지 않고 `ALREADY_DONE` 입니다 — 재시도가
 * 안전한 이유입니다. 첫 장이 나간 뒤에는 값이 달라도 바꿀 수 없어 `DESIGN_FROZEN` 입니다.
 */
export async function registerPhotocardDesign(
  designId: bigint,
  maxSupply: bigint,
  metadataCid: string,
): Promise<DesignRegisterResult> {
  requireDeployed();

  const metadataUri = metadataUriOf(metadataCid);
  const design = await getDesign(designId);

  if (design.registered) {
    // 첫 장이 나가면 잠깁니다. 같은 값이어도 다시 보낼 이유가 없습니다.
    if (design.frozen) {
      const same = design.maxSupply === maxSupply && design.metadataUri === metadataUri;
      if (!same) throw errors.designFrozen(designId.toString());

      return {
        status: 'ALREADY_DONE',
        txHash: null,
        designId: designId.toString(),
        maxSupply: design.maxSupply.toString(),
        metadataUri: design.metadataUri,
      };
    }

    if (design.maxSupply === maxSupply && design.metadataUri === metadataUri) {
      logger.info(`도안 등록 건너뜀 (이미 같은 값) design=${designId}`);
      return {
        status: 'ALREADY_DONE',
        txHash: null,
        designId: designId.toString(),
        maxSupply: maxSupply.toString(),
        metadataUri,
      };
    }
    // 아직 한 장도 안 나갔으면 고칠 수 있습니다. 그대로 보냅니다.
  }

  const txHash = await registerDesign(designId, maxSupply, metadataCid);
  logger.info(`도안 등록 design=${designId} max=${maxSupply} tx=${short(txHash)}`);

  return {
    status: 'PENDING',
    txHash,
    designId: designId.toString(),
    maxSupply: maxSupply.toString(),
    metadataUri,
  };
}

/**
 * 배치 발행. 한 요청이 한 트랜잭션입니다.
 *
 * ── 보내기 전에 막는 것들 ─────────────────────────────────────────
 * 정지·미등록 도안·수량 초과는 **여기서** 걸러냅니다. 그냥 보내면 `202` 를 돌려준 뒤
 * 10초쯤 지나 배치 전체가 실패한 걸 알게 되고, 그동안 Spring 은 정상 처리로 압니다.
 *
 * 주의: 사전 확인은 **확정된 상태만** 봅니다. 확정 전 중복 요청은 둘 다 통과하지만
 *       **카드는 안전합니다** — 컨트랙트가 이미 발행된 키를 건너뜁니다.
 */
export async function issuePhotocards(items: IssueRequestItem[]): Promise<IssueBatchResult> {
  requireDeployed();

  if (items.length === 0) throw errors.badRequest('items 가 비어 있습니다');

  const limit = await maxBatch();
  if (items.length > limit) {
    throw errors.badRequest(
      `한 번에 ${limit}건까지 보낼 수 있습니다. 잘라서 여러 번 보내세요`,
      { max: limit, received: items.length },
    );
  }

  const prepared: IssueItem[] = items.map((item) => {
    /* 정규식은 모양만 봅니다. 체크섬이 틀린 주소를 그대로 넘기면 ethers 가 던지고
       500 이 됩니다 — 잘못된 건 입력이므로 여기서 400 으로 돌려보냅니다. */
    const to = normalizeAddress(item.to);
    if (to === null) throw errors.invalidAddress('to', item.to);
    return { photocardKey: item.photocardKey, designId: BigInt(item.designId), to };
  });

  if (await isIssuePaused()) throw errors.contractPaused('포토카드 발행');

  await assertCapacity(prepared);

  const txHash = await issueBatch(prepared);
  logger.info(`포토카드 발행 ${prepared.length}건 tx=${short(txHash)}`);

  /* 확정 감시에 올리고 DB 를 `MINTING` 으로 옮깁니다. Spring 은 txHash 를 폴링하지
     않고 자기 행의 status 가 바뀌는 걸로 압니다. (DESIGN.md 1장 예외) */
  await watchIssueBatch(
    prepared.map((item) => ({
      photocardKey: item.photocardKey,
      tokenId: item.designId.toString(),
    })),
    txHash,
  );

  return { status: 'PENDING', txHash, count: prepared.length };
}

/**
 * 배치 안의 도안이 전부 등록돼 있고 수량이 남는지 확인합니다.
 *
 * **배치 안에서 같은 도안이 여러 장이므로 개수를 세서 비교해야 합니다.** 한 장씩
 * 확인하면 마지막 한 장에서 넘치는 배치를 통과시킵니다.
 */
async function assertCapacity(items: IssueItem[]): Promise<void> {
  const wanted = new Map<bigint, number>();
  for (const item of items) {
    wanted.set(item.designId, (wanted.get(item.designId) ?? 0) + 1);
  }

  for (const [designId, count] of wanted) {
    const design = await getDesign(designId);
    if (!design.registered) throw errors.designNotRegistered(designId.toString());

    const remaining = design.maxSupply - design.issued;
    if (BigInt(count) > remaining) {
      throw errors.designSoldOut(designId.toString(), {
        designId: designId.toString(),
        remaining: remaining.toString(),
        requested: count,
      });
    }
  }
}

/**
 * 이 카드 키로 발행된 적이 있는지. **응답을 못 받았을 때의 복구 조회**입니다. (4-3)
 *
 * 도안도 소유자도 돌려주지 않습니다 — 컨트랙트가 갖고 있지 않습니다. 티켓과 다른
 * 지점인데, 포카의 `tokenId` 는 도안이라 카드 키에서 계산되지 않기 때문입니다.
 */
export async function findPhotocardByKey(photocardKey: string): Promise<PhotocardLookupResult> {
  requireDeployed();
  return { issued: await isIssued(photocardKey) };
}

/**
 * 도안별 보유 장수. **대사(reconciliation) 전용입니다** (DESIGN.md 4-5).
 *
 * 화면용으로 쓰지 마세요 — "내 포카 목록" 은 Spring 이 자기 DB 에서 내려줍니다.
 * 매 요청이 여기를 타면 RPC 레이트리밋에 걸립니다.
 */
export async function getPhotocardBalance(
  address: string,
  designId: bigint,
): Promise<PhotocardBalanceResult> {
  requireDeployed();

  const owner = normalizeAddress(address);
  if (owner === null) throw errors.invalidAddress('address', address);

  const [balance, design] = await Promise.all([balanceOf(owner, designId), getDesign(designId)]);

  return {
    address: owner,
    designId: designId.toString(),
    balance: balance.toString(),
    totalSupply: design.issued.toString(),
    // 0 이면 등록되지 않은 도안입니다. 404 로 만들지 않습니다 — 대사는 그것도 알아야 합니다.
    maxSupply: design.maxSupply.toString(),
  };
}
