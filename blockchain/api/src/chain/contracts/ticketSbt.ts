import { keccak256, toUtf8Bytes, ZeroAddress } from 'ethers';
import { TicketSBT__factory, readDeployment, type TicketSBT } from '@teacat/contracts';
import { env, networkNameOf } from '../../config';
import { operatorAddress, operatorSigner } from '../provider';
import { sendSerialized } from '../nonce';

/**
 * 티켓 SBT 컨트랙트 접근.
 *
 * 주소를 코드에 적지 않습니다. 배포 스크립트가 남긴 `deployments/<network>.json`
 * 을 읽습니다. (DESIGN.md 12장)
 *
 * 발행과 소각을 **전부 오퍼레이터가 서명합니다.** 캣머니 소각과 달리 유저 키를
 * 파생하지 않습니다 — 티켓은 유저가 자기 것을 태우는 게 아니라 서비스가 예매
 * 결과를 기록하는 것이기 때문입니다. 유저는 애초에 티켓을 움직일 수 없습니다(SBT).
 *
 * 주의: `ethers` 를 import 하는 곳은 `chain/` 안뿐입니다. (4-1)
 */

const CONTRACT_NAME = 'TicketSBT';

export interface OnChainTicket {
  /** 이 번호로 발행된 적이 있는가. false 면 애초에 없는 번호입니다 */
  issued: boolean;
  /** 지금 소유자. **소각됐으면 null** 입니다 */
  owner: string | null;
}

/** 배포 파일에서 주소를 찾습니다. 없으면 `null` — 부르는 쪽이 503 으로 바꿉니다. */
export function ticketSbtAddress(): string | null {
  const deployment = readDeployment(networkNameOf(env.CHAIN_ID));
  return deployment?.contracts[CONTRACT_NAME] ?? null;
}

function contract(): TicketSBT {
  const address = ticketSbtAddress();
  if (address === null) {
    // 여기까지 오면 부르는 쪽이 배포 여부를 안 봤다는 뜻입니다.
    throw new Error(`${CONTRACT_NAME} 이 ${networkNameOf(env.CHAIN_ID)} 에 배포되지 않았습니다`);
  }
  return TicketSBT__factory.connect(address, operatorSigner());
}

/**
 * Spring 이 보낸 `ticketKey` 를 온체인 키로 바꿉니다.
 *
 * Spring 에 keccak256 의존성을 만들지 않기 위해 서버가 해싱합니다.
 * (DESIGN.md 결정 이력 2026-09-02)
 */
export function hashOf(value: string): string {
  return keccak256(toUtf8Bytes(value));
}

/**
 * `ticketKey` → tokenId. **컨트랙트의 `tokenIdOf` 와 같은 식이어야 합니다.**
 *
 * 번호가 키에서 나오므로 **트랜잭션을 보내기 전에** 계산됩니다. 그래서 발행
 * 응답에 tokenId 를 담을 수 있습니다 — 순번이었다면 블록이 확정될 때까지(약 10초)
 * 알 수 없는 값입니다. (DESIGN.md 4-2)
 *
 * 주의: 여기서 나온 번호는 **아직 체인에 없습니다.** 그 키가 갖게 될 번호일 뿐이라,
 *       발행이 실패하면 그런 토큰은 생기지 않습니다.
 */
export function tokenIdOf(ticketKey: string): bigint {
  return BigInt(hashOf(ticketKey));
}

/** 0 주소는 "소각됨" 을 뜻합니다. 서비스가 주소인 척 다루지 않도록 여기서 null 로 바꿉니다. */
function ownerOrNull(owner: string): string | null {
  return owner === ZeroAddress ? null : owner.toLowerCase();
}

// ── 조회 ──────────────────────────────────────────────────────

export async function getTicket(tokenId: bigint): Promise<OnChainTicket> {
  const [issued, owner] = await contract().getTicket(tokenId);
  return { issued, owner: ownerOrNull(owner) };
}

/**
 * `ticketKey` 로 발행 여부를 봅니다. 응답을 못 받은 재시도를 성공으로 바꿀 때 씁니다. (4-3)
 *
 * 소각된 티켓도 `issued: true` 입니다 — 그 키는 이미 소비됐고 재발행되면 안 됩니다.
 */
export async function issuedTicket(
  ticketKeyHash: string,
): Promise<{ issued: boolean; tokenId: bigint; owner: string | null }> {
  const [issued, tokenId, owner] = await contract().issuedTicket(ticketKeyHash);
  return { issued, tokenId, owner: ownerOrNull(owner) };
}

/**
 * 발행 정지 스위치 상태.
 *
 * 서비스가 **보내기 전에** 확인합니다. 안 보면 202 를 돌려준 뒤 10초쯤 지나
 * tx 조회에서야 `IssueIsPaused` 로 실패합니다 — Spring 은 그동안 정상 처리로 압니다.
 */
export async function isIssuePaused(): Promise<boolean> {
  return contract().issuePaused();
}

// ── 쓰기 ──────────────────────────────────────────────────────
// **확정을 기다리지 않고** txHash 만 돌려줍니다. (DESIGN.md 4-2)
// SSAFY 체인은 블록이 약 10초입니다. 여기서 기다리면 Spring 스레드가 그만큼 묶입니다.

/**
 * 발행.
 *
 * 논스를 명시적으로 넘깁니다. 안 넘기면 ethers 가 250ms 캐시된 값을 재사용해
 * 동시 요청이 같은 논스를 쓰고 **트랜잭션 하나가 조용히 사라집니다.** (chain/nonce.ts)
 */
export async function issue(to: string, ticketKeyHash: string): Promise<string> {
  return sendSerialized(operatorAddress, async (nonce) => {
    const tx = await contract().issue(to, ticketKeyHash, { nonce });
    return tx.hash;
  });
}

/** 소각 — 예매 취소. tokenId 는 영구 소멸합니다. */
export async function burnTicket(tokenId: bigint): Promise<string> {
  return sendSerialized(operatorAddress, async (nonce) => {
    const tx = await contract().burnTicket(tokenId, { nonce });
    return tx.hash;
  });
}
