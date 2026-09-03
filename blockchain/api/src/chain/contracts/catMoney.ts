import { keccak256, toUtf8Bytes } from 'ethers';
import { CatMoney__factory, readDeployment, type CatMoney } from '@teacat/contracts';
import { env, networkNameOf } from '../../config';
import { operatorSigner, provider } from '../provider';
import { userSigner } from '../keys/hdWallet';
import { ensureLocalGas } from '../localGas';
import { sendSerialized } from '../nonce';

/**
 * 캣머니 컨트랙트 접근.
 *
 * 주소를 코드에 적지 않습니다. 배포 스크립트가 남긴 `deployments/<network>.json`
 * 을 읽습니다. (DESIGN.md 12장)
 *
 * 주의: `ethers` 를 import 하는 곳은 `chain/` 안뿐입니다. (4-1)
 */

const CONTRACT_NAME = 'CatMoney';

/** 배포 파일에서 주소를 찾습니다. 없으면 `null` — 부르는 쪽이 503 으로 바꿉니다. */
export function catMoneyAddress(): string | null {
  const deployment = readDeployment(networkNameOf(env.CHAIN_ID));
  return deployment?.contracts[CONTRACT_NAME] ?? null;
}

function contract(): CatMoney {
  const address = catMoneyAddress();
  if (address === null) {
    // 여기까지 오면 부르는 쪽이 배포 여부를 안 봤다는 뜻입니다.
    throw new Error(`${CONTRACT_NAME} 이 ${networkNameOf(env.CHAIN_ID)} 에 배포되지 않았습니다`);
  }
  return CatMoney__factory.connect(address, operatorSigner());
}

/**
 * Spring 이 보낸 문자열 키를 온체인 키로 바꿉니다.
 *
 * Spring 에 keccak256 의존성을 만들지 않기 위해 서버가 해싱합니다.
 * (DESIGN.md 결정 이력 2026-09-02)
 */
export function operationKeyOf(value: string): string {
  return keccak256(toUtf8Bytes(value));
}

/**
 * 지갑 시드 발행의 멱등 키.
 *
 * **파생 인덱스에서 만듭니다.** Spring 이 키를 따로 관리할 필요가 없고,
 * 인덱스는 유저당 하나이며 재사용하지 않으므로(5-1) 1회 지급이 자동으로 보장됩니다.
 * 가입 요청이 몇 번을 재시도돼도 시드는 한 번만 나갑니다.
 */
export function walletSeedKey(derivationIndex: number): string {
  return operationKeyOf(`WALLET_SEED:${derivationIndex}`);
}

/** 이미 발행됐는지. 응답을 못 받은 재시도를 성공으로 바꿀 때 씁니다. (4-3) */
export async function isMintExecuted(operationKey: string): Promise<boolean> {
  return contract().isMintExecuted(operationKey);
}

/** 이미 소각됐는지. 소각은 호출자별로 기록되므로 주소가 필요합니다. */
export async function isBurnExecuted(account: string, operationKey: string): Promise<boolean> {
  return contract().isBurnExecuted(account, operationKey);
}

export async function balanceOf(address: string): Promise<bigint> {
  return contract().balanceOf(address);
}

/**
 * 발행. **확정을 기다리지 않고** txHash 만 돌려줍니다. (DESIGN.md 4-2)
 *
 * SSAFY 체인은 블록이 약 10초입니다. 여기서 기다리면 Spring 스레드가 그만큼 묶입니다.
 */
export async function mint(to: string, amount: bigint, operationKey: string): Promise<string> {
  // 논스를 명시적으로 넘깁니다. 안 넘기면 ethers 가 캐시된 값을 재사용해
  // 동시 요청이 같은 논스를 씁니다. (chain/nonce.ts)
  return sendSerialized(async (nonce) => {
    const tx = await contract().mint(to, amount, operationKey, { nonce });
    return tx.hash;
  });
}

/**
 * 소각. **유저 본인이 서명합니다.**
 *
 * 컨트랙트에 `burnFrom` 을 두지 않았기 때문입니다 — 남의 잔액을 태우는 함수가 있으면
 * 키 하나로 전 유저의 포인트를 지울 수 있습니다. 그래서 니모닉에서 그 유저의 키를
 * 파생해 서명합니다. 온체인에는 "유저 본인이 태웠다" 로 남습니다.
 *
 * 논스는 유저마다 따로라 오퍼레이터 큐를 타지 않습니다. 한 유저가 동시에 두 번
 * 결제하는 상황은 Spring 이 막습니다.
 */
export async function burnAs(
  derivationIndex: number,
  amount: bigint,
  operationKey: string,
): Promise<string> {
  const signer = userSigner(derivationIndex);
  // 로컬 체인에서만 동작합니다. SSAFY 체인은 가스가 무료라 아무것도 하지 않습니다.
  await ensureLocalGas(await signer.getAddress());

  const tx = await CatMoney__factory.connect(requireAddress(), signer).burn(amount, operationKey);
  return tx.hash;
}

/** 주소를 못 찾으면 던집니다. 부르는 쪽이 미리 `catMoneyAddress()` 로 확인합니다. */
function requireAddress(): string {
  const address = catMoneyAddress();
  if (address === null) {
    throw new Error(`${CONTRACT_NAME} 이 ${networkNameOf(env.CHAIN_ID)} 에 배포되지 않았습니다`);
  }
  return address;
}
