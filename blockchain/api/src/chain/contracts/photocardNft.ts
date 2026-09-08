import { PhotocardNFT__factory, readDeployment, type PhotocardNFT } from '@teacat/contracts';
import { env, networkNameOf } from '../../config';
import {
  contractOperatorAddress,
  contractOperatorSigner,
  operatorAddress,
  operatorSigner,
  provider,
} from '../provider';
import { ensureLocalGas } from '../localGas';
import { sendSerialized } from '../nonce';
import { hashOf } from '../hash';

/**
 * 포토카드 NFT 컨트랙트 접근. (PHOTOCARD_PLAN.md 3장)
 *
 * 주소를 코드에 적지 않습니다. 배포 스크립트가 남긴 `deployments/<network>.json`
 * 을 읽습니다. (DESIGN.md 12장)
 *
 * ── 서명자가 둘입니다 ─────────────────────────────────────────────
 *
 *   발행(`issueBatch`)        `MINTER_ROLE`    — 릴레이어 키
 *   도안 등록·정지            `OPERATOR_ROLE`  — 별도 키일 수 있습니다
 *
 * 티켓·캣머니와 달리 한 키로 다 되지 않습니다. 역할을 나눈 환경에서 발행 키로
 * `registerDesign` 을 부르면 전부 `AccessControlUnauthorizedAccount` 입니다.
 *
 * 주의: `ethers` 를 import 하는 곳은 `chain/` 안뿐입니다. (4-1)
 */

const CONTRACT_NAME = 'PhotocardNFT';

/** 온체인 메타데이터 주소의 스킴. 서버가 붙입니다 — Spring 은 CID 만 보냅니다. */
const IPFS_SCHEME = 'ipfs://';

export interface OnChainDesign {
  /** 등록된 적이 있는가. false 면 나머지는 의미가 없습니다 */
  registered: boolean;
  maxSupply: bigint;
  /** 지금까지 발행된 장수 */
  issued: bigint;
  metadataUri: string;
  /** 첫 장이 나가 잠겼는가. true 면 수량·URI 를 다시 등록할 수 없습니다 */
  frozen: boolean;
}

/** 배치 발행 한 건. `photocardKey` 는 원문 문자열이고 해싱은 여기서 합니다. */
export interface IssueItem {
  /** `nft_photocards.id` */
  photocardKey: string;
  /** `nft_photocard_designs.id` — 그대로 tokenId 입니다 */
  designId: bigint;
  /** 받는 유저의 파생 지갑 주소 */
  to: string;
}

/** 배포 파일에서 주소를 찾습니다. 없으면 `null` — 부르는 쪽이 503 으로 바꿉니다. */
export function photocardNftAddress(): string | null {
  const deployment = readDeployment(networkNameOf(env.CHAIN_ID));
  return deployment?.contracts[CONTRACT_NAME] ?? null;
}

function requireAddress(): string {
  const address = photocardNftAddress();
  if (address === null) {
    // 여기까지 오면 부르는 쪽이 배포 여부를 안 봤다는 뜻입니다.
    throw new Error(`${CONTRACT_NAME} 이 ${networkNameOf(env.CHAIN_ID)} 에 배포되지 않았습니다`);
  }
  return address;
}

/** 조회 전용. 서명자를 물리지 않습니다 — 읽기에 키를 쓸 이유가 없습니다. */
function read(): PhotocardNFT {
  return PhotocardNFT__factory.connect(requireAddress(), provider);
}

/** `MINTER_ROLE` 경로 — 발행. */
function asMinter(): PhotocardNFT {
  return PhotocardNFT__factory.connect(requireAddress(), operatorSigner());
}

/** `OPERATOR_ROLE` 경로 — 도안 등록·정지. */
function asOperator(): PhotocardNFT {
  return PhotocardNFT__factory.connect(requireAddress(), contractOperatorSigner());
}

/**
 * 메타데이터 CID → 온체인 URI.
 *
 * 스킴을 서버가 붙입니다. Spring 이 `ipfs://` 를 직접 만들게 하면 한쪽만 바뀌었을 때
 * 지갑이 열지 못하는 주소가 조용히 올라갑니다 — 그리고 **첫 장이 나가면 못 고칩니다.**
 */
export function metadataUriOf(metadataCid: string): string {
  return metadataCid.startsWith(IPFS_SCHEME) ? metadataCid : `${IPFS_SCHEME}${metadataCid}`;
}

// ── 조회 ──────────────────────────────────────────────────────

/**
 * 도안 하나의 온체인 값 전부.
 *
 * 발행을 보내기 **전에** 확인하는 용도이기도 합니다. 미등록·품절을 안 보고 보내면
 * 202 를 돌려준 뒤 10초쯤 지나서야 배치 전체가 실패한 걸 알게 됩니다.
 */
export async function getDesign(designId: bigint): Promise<OnChainDesign> {
  const [maxSupply, issued, metadataUri, frozen] = await read().getDesign(designId);
  return { registered: maxSupply > 0n, maxSupply, issued, metadataUri, frozen };
}

/**
 * 이 카드 키로 발행된 적이 있는가. 응답을 못 받았을 때의 복구 조회입니다. (4-3)
 *
 * 도안도 소유자도 돌려주지 않습니다 — 컨트랙트가 갖고 있지 않습니다.
 * 그건 `nft_photocards` 행이 이미 아는 값이라 체인에 두면 두 벌이 됩니다.
 */
export async function isIssued(photocardKey: string): Promise<boolean> {
  return read().isIssued(hashOf(photocardKey));
}

/**
 * 그 주소가 그 도안을 몇 장 갖고 있는가. **대사(reconciliation) 전용입니다.**
 *
 * 화면용으로 쓰지 마세요 — "내 포카 목록" 은 Spring 이 자기 DB 에서 내려줍니다.
 * (DESIGN.md 4-5)
 */
export async function balanceOf(address: string, designId: bigint): Promise<bigint> {
  return read().balanceOf(address, designId);
}

export async function isIssuePaused(): Promise<boolean> {
  return read().issuePaused();
}

/** 컨트랙트가 받는 한 배치의 상한. 서비스가 이 값으로 요청을 미리 막습니다. */
export async function maxBatch(): Promise<number> {
  return Number(await read().MAX_BATCH());
}

/* 주의: `totalSupply` 는 쓰지 마세요.
   `ERC1155Supply` 가 `totalSupply()` 와 `totalSupply(uint256)` 을 둘 다 갖고 있어서
   ethers 가 이름만으로는 고르지 못하고 던집니다. 굳이 쓴다면
   `read()['totalSupply(uint256)'](id)` 처럼 시그니처를 적어야 합니다.
   발행량은 `getDesign().issued` 로 받으세요 — 그래서 여기 함수를 두지 않았습니다. */

// ── 쓰기 ──────────────────────────────────────────────────────
// **확정을 기다리지 않고** txHash 만 돌려줍니다. (DESIGN.md 4-2)

/**
 * 도안 등록 — 한정 수량과 IPFS 메타데이터를 못 박습니다.
 *
 * `totalSupply(designId) == 0` 인 동안은 다시 불러서 고칠 수 있고, 첫 장이 나가면
 * `DesignFrozen` 으로 영구히 잠깁니다.
 *
 * `OPERATOR_ROLE` 로 서명하므로 논스도 그 주소로 셉니다 — 발행 키와 다른 지갑일 수
 * 있어서, 한 큐에 섞어 세면 주소마다 다른 논스가 뒤엉킵니다. (chain/nonce.ts)
 */
export async function registerDesign(
  designId: bigint,
  maxSupply: bigint,
  metadataCid: string,
): Promise<string> {
  // 로컬 체인에서만 동작합니다. SSAFY 체인은 가스가 무료라 아무것도 하지 않습니다.
  await ensureLocalGas(contractOperatorAddress);

  return sendSerialized(contractOperatorAddress, async (nonce) => {
    const tx = await asOperator().registerDesign(designId, maxSupply, metadataUriOf(metadataCid), {
      nonce,
    });
    return tx.hash;
  });
}

/**
 * 배치 발행. 한 요청이 한 트랜잭션입니다.
 *
 * **이미 발행된 키는 컨트랙트가 건너뜁니다.** 그래서 같은 배열을 그대로 다시 보내는
 * 것이 안전합니다 — 응답을 못 받았을 때 Spring 이 할 수 있는 가장 단순한 행동입니다.
 *
 * 반대로 미등록 도안·수량 초과는 **배치 전체를 revert 시킵니다.** 그 자리만 건너뛰면
 * Spring 은 성공으로 알고 넘어가는데 그 카드는 영원히 안 나갑니다.
 */
export async function issueBatch(items: IssueItem[]): Promise<string> {
  const to = items.map((item) => item.to);
  const tokenIds = items.map((item) => item.designId);
  const keys = items.map((item) => hashOf(item.photocardKey));

  return sendSerialized(operatorAddress, async (nonce) => {
    const tx = await asMinter().issueBatch(to, tokenIds, keys, { nonce });
    return tx.hash;
  });
}

/** 발행 정지 스위치. 이동에는 걸리지 않습니다. */
export async function setIssuePaused(paused: boolean): Promise<string> {
  await ensureLocalGas(contractOperatorAddress);

  return sendSerialized(contractOperatorAddress, async (nonce) => {
    const tx = await asOperator().setIssuePaused(paused, { nonce });
    return tx.hash;
  });
}
