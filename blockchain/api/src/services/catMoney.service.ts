import {
  balanceOf,
  burnAs,
  catMoneyAddress,
  isBurnExecuted,
  isMintExecuted,
  mint,
  operationKeyOf,
} from '../chain/contracts/catMoney';
import { deriveUserAddress } from '../chain/keys/hdWallet';
import { errors } from '../shared/errors';

/**
 * 캣머니 유스케이스.
 *
 * **금액과 지급 정책은 Spring 이 정합니다.** 여기서는 판단하지 않고 실행만 합니다.
 * (DESIGN.md 1장)
 */

/** 컨트랙트가 `decimals = 0` 으로 고정입니다. 코드가 불변이라 바뀌지 않습니다. */
const DECIMALS = 0 as const;
const SYMBOL = 'TCAT' as const;

export interface BalanceResult {
  address: string;
  /** 정수 문자열. JSON number 로 주면 큰 값에서 정밀도가 깨집니다 */
  balance: string;
  decimals: typeof DECIMALS;
  symbol: typeof SYMBOL;
}

export interface WriteResult {
  /** 방금 보냈으면 PENDING, 이미 처리돼 있었으면 ALREADY_DONE */
  status: 'PENDING' | 'ALREADY_DONE';
  /** ALREADY_DONE 이면 새로 보낸 트랜잭션이 없어 null 입니다 */
  txHash: string | null;
}

/** 컨트랙트가 배포돼 있는지. 없으면 여기서 멈춥니다 — 조용히 넘기면 안 됩니다. */
function requireDeployed(): void {
  if (catMoneyAddress() === null) throw errors.contractUnavailable('CatMoney');
}

export async function getBalance(address: string): Promise<BalanceResult> {
  requireDeployed();
  return {
    address: address.toLowerCase(),
    balance: (await balanceOf(address)).toString(),
    decimals: DECIMALS,
    symbol: SYMBOL,
  };
}

/**
 * 발행. 원화 입금·보상·예매 취소 환급이 전부 여기로 옵니다.
 *
 * 같은 `operationKey` 가 다시 오면 새 트랜잭션을 보내지 않고 `ALREADY_DONE` 입니다.
 * 재시도가 안전한 이유입니다. (DESIGN.md 4-3)
 */
export async function mintCatMoney(
  operationKey: string,
  to: string,
  amount: string,
): Promise<WriteResult> {
  requireDeployed();

  const key = operationKeyOf(operationKey);
  if (await isMintExecuted(key)) return { status: 'ALREADY_DONE', txHash: null };

  return { status: 'PENDING', txHash: await mint(to, BigInt(amount), key) };
}

/**
 * 소각. 티켓 결제(일부 결제)와 원화 출금이 여기로 옵니다.
 *
 * 유저 본인이 서명하므로, `derivationIndex` 로 만든 주소가 `from` 과 같은지
 * 먼저 확인합니다. 다르면 **엉뚱한 사람의 잔액을 태우게 됩니다.**
 */
export async function burnCatMoney(
  operationKey: string,
  from: string,
  derivationIndex: number,
  amount: string,
): Promise<WriteResult> {
  requireDeployed();

  const derived = deriveUserAddress(derivationIndex);
  if (derived !== from.toLowerCase()) {
    throw errors.badRequest(
      `derivationIndex ${derivationIndex} 로 만든 주소가 from 과 다릅니다`,
      { derived, from: from.toLowerCase() },
    );
  }

  const key = operationKeyOf(operationKey);
  if (await isBurnExecuted(derived, key)) return { status: 'ALREADY_DONE', txHash: null };

  /* 잔액을 미리 봅니다. 안 보면 체인에서 revert 되고, Spring 은 202 를 받은 뒤
     한참 있다 tx 조회에서야 실패를 압니다. 여기서 막으면 즉시 422 로 알려줍니다.
     주의: 이건 사용자 경험을 위한 것이고, 진짜 방어는 컨트랙트가 합니다 —
     확인과 전송 사이에 잔액이 바뀔 수 있습니다. */
  const value = BigInt(amount);
  if ((await balanceOf(derived)) < value) {
    throw errors.insufficientBalance(derived);
  }

  return { status: 'PENDING', txHash: await burnAs(derivationIndex, value, key) };
}
