import { deriveUserAddress, derivationPath } from '../chain/keys/hdWallet';
import {
  catMoneyAddress,
  isMintExecuted,
  mint,
  walletSeedKey,
} from '../chain/contracts/catMoney';
import { errors } from '../shared/errors';

/** 시드 발행 결과. 요청에 `seedAmount` 가 없으면 `null` 입니다. */
export interface SeedResult {
  /** 방금 보냈으면 PENDING, 이미 발행돼 있었으면 ALREADY_DONE */
  status: 'PENDING' | 'ALREADY_DONE';
  amount: string;
  /** ALREADY_DONE 이면 새로 보낸 트랜잭션이 없어 null 입니다 */
  txHash: string | null;
}

export interface WalletResult {
  address: string;
  derivationIndex: number;
  path: string;
  /** 릴레이어 단계에서는 EOA, M4 부터 SMART_ACCOUNT (DESIGN.md 5-3 wallets.type) */
  type: 'RELAYER_EOA';
  seed: SeedResult | null;
}

/**
 * 파생 인덱스로 유저 지갑 주소를 계산하고, 요청하면 시드 캣머니를 발행합니다.
 *
 * **주소는 저장하지 않습니다.** DB 에 넣는 건 Spring 입니다. (DESIGN.md 1장)
 * 같은 인덱스로 몇 번을 불러도 같은 주소가 나오고, 시드도 한 번만 나가므로
 * 재시도가 안전합니다.
 *
 * `seedAmount` 는 **Spring 이 정합니다.** 이 서비스는 금액을 판단하지 않습니다.
 */
export async function resolveWallet(
  derivationIndex: number,
  seedAmount?: string,
): Promise<WalletResult> {
  const wallet: WalletResult = {
    address: deriveUserAddress(derivationIndex),
    derivationIndex,
    path: derivationPath(derivationIndex),
    type: 'RELAYER_EOA',
    seed: null,
  };

  if (seedAmount === undefined) return wallet;

  /* 시드를 요청했는데 컨트랙트가 없으면 **여기서 멈춥니다.**
     조용히 seed: null 로 넘기면 유저가 캣머니 없이 가입되고,
     그 사실은 아무도 모른 채 나중에 발견됩니다. */
  if (catMoneyAddress() === null) {
    throw errors.contractUnavailable('CatMoney');
  }

  const operationKey = walletSeedKey(derivationIndex);

  // 이미 나갔는지 먼저 봅니다. 재시도를 실패가 아니라 성공으로 바꿉니다. (4-3)
  if (await isMintExecuted(operationKey)) {
    return { ...wallet, seed: { status: 'ALREADY_DONE', amount: seedAmount, txHash: null } };
  }

  const txHash = await mint(wallet.address, BigInt(seedAmount), operationKey);
  return { ...wallet, seed: { status: 'PENDING', amount: seedAmount, txHash } };
}
