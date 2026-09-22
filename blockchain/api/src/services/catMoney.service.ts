import {
  balanceOf,
  burnAs,
  catMoneyAddress,
  isBurnExecuted,
  isMintExecuted,
  isPaused,
  isTransferExecuted,
  mint,
  operationKeyOf,
  transferAs,
} from '../chain/contracts/catMoney';
import { deriveUserAddress } from '../chain/keys/hdWallet';
import { normalizeAddress } from '../chain/address';
import { errors } from '../shared/errors';
import { logger, short } from '../shared/logger';

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

/**
 * 발행 사유. 온체인에는 안 남고 로그에만 남습니다 — 대사(M2) 때 씁니다.
 *
 * `ADMIN_GRANT` 는 관리자가 테스트용으로 넣어주는 돈입니다. 실제 원화가 들어온 적이
 * 없으므로 **대사에서 제외해야 합니다** — `DEPOSIT` 과 섞이면 장부가 맞지 않습니다.
 */
export type MintReason = 'DEPOSIT' | 'REWARD' | 'REFUND' | 'ADMIN_GRANT' | 'GAME_PRIZE';
/** 소각 사유. `ADMIN_BURN` 도 같은 이유로 대사 대상이 아닙니다. */
export type BurnReason = 'PAYMENT' | 'WITHDRAWAL' | 'ADMIN_BURN' | 'GAME_BET';

export interface WriteResult {
  /** 방금 보냈으면 PENDING, 이미 처리돼 있었으면 ALREADY_DONE */
  status: 'PENDING' | 'ALREADY_DONE';
  /** ALREADY_DONE 이면 새로 보낸 트랜잭션이 없어 null 입니다 */
  txHash: string | null;
}

/* 로그에는 **해싱된** operationKey 를 남깁니다. Spring 이 보낸 원문이 아닙니다.
   두 가지 이유입니다.
     1. 온체인 이벤트의 topic 과 같은 값이라 대사할 때 바로 맞춰볼 수 있습니다
     2. 그 자리에 무엇이 들어올지 우리가 정하지 못합니다. 실제로 개인키를 붙여넣은
        사고가 있었습니다 — 원문을 찍었다면 로그에 남았을 것입니다 (DESIGN.md 5-1) */

/** 컨트랙트가 배포돼 있는지. 없으면 여기서 멈춥니다 — 조용히 넘기면 안 됩니다. */
function requireDeployed(): void {
  if (catMoneyAddress() === null) throw errors.contractUnavailable('CatMoney');
}

export async function getBalance(address: string): Promise<BalanceResult> {
  requireDeployed();

  const account = normalizeAddress(address);
  if (account === null) throw errors.invalidAddress('address', address);

  return {
    address: account,
    balance: (await balanceOf(account)).toString(),
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
  reason: MintReason,
): Promise<WriteResult> {
  requireDeployed();

  // 티켓 발행과 같은 이유입니다 — 체크섬이 틀린 주소는 ethers 가 던져 500 이 됩니다.
  const target = normalizeAddress(to);
  if (target === null) throw errors.invalidAddress('to', to);

  const key = operationKeyOf(operationKey);
  if (await isMintExecuted(key)) {
    logger.info(
      `캣머니 발행 건너뜀 (이미 처리됨) ${reason} ${amount} → ${target} key=${short(key)}`,
    );
    return { status: 'ALREADY_DONE', txHash: null };
  }

  const txHash = await mint(target, BigInt(amount), key);
  logger.info(`캣머니 발행 ${reason} ${amount} → ${target} key=${short(key)} tx=${short(txHash)}`);
  return { status: 'PENDING', txHash };
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
  reason: BurnReason,
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
  if (await isBurnExecuted(derived, key)) {
    logger.info(
      `캣머니 소각 건너뜀 (이미 처리됨) ${reason} ${amount} ← ${derived} key=${short(key)}`,
    );
    return { status: 'ALREADY_DONE', txHash: null };
  }

  /* 잔액을 미리 봅니다. 안 보면 체인에서 revert 되고, Spring 은 202 를 받은 뒤
     한참 있다 tx 조회에서야 실패를 압니다. 여기서 막으면 즉시 422 로 알려줍니다.
     주의: 이건 사용자 경험을 위한 것이고, 진짜 방어는 컨트랙트가 합니다 —
     확인과 전송 사이에 잔액이 바뀔 수 있습니다. */
  const value = BigInt(amount);
  if ((await balanceOf(derived)) < value) {
    throw errors.insufficientBalance(derived);
  }

  const txHash = await burnAs(derivationIndex, value, key);
  logger.info(`캣머니 소각 ${reason} ${amount} ← ${derived} key=${short(key)} tx=${short(txHash)}`);
  return { status: 'PENDING', txHash };
}

/**
 * 전송. 포카 마켓 정산에서 **구매자 → 판매자**로 캣머니가 갑니다.
 *
 * **발행도 소각도 아닙니다.** `totalSupply` 는 그대로고 소유자만 바뀝니다 — 그래서
 * 이 값이 여전히 "유저들이 아직 안 쓴 캣머니 총량" 입니다. (DESIGN.md 6장 ②)
 *
 * 소각과 같이 유저 본인이 서명하므로 `derivationIndex` 로 만든 주소가 `from` 과
 * 같은지 먼저 확인합니다. 다르면 **엉뚱한 사람의 잔액이 나갑니다.**
 *
 * ── 이 함수는 돈만 옮깁니다 ───────────────────────────────────────
 *
 * 카드 이전(`transferPhotocard`)과 **원자적이지 않습니다.** 서로 다른 컨트랙트의
 * 서로 다른 트랜잭션이라 한쪽만 성공할 수 있습니다. 순서와 보상은 Spring 이
 * 소유합니다 — 캣머니 전송이 **확정된 뒤** 카드를 옮기고, 카드가 실패하면 별도
 * `operationKey` 로 되돌립니다. (PHOTOCARD_PLAN.md 7장)
 */
export async function transferCatMoney(
  operationKey: string,
  from: string,
  derivationIndex: number,
  to: string,
  amount: string,
  tradeId: string,
): Promise<WriteResult> {
  requireDeployed();

  // 체크섬이 틀린 주소는 ethers 가 던져 500 이 됩니다. 잘못된 건 입력이므로 400 입니다.
  const target = normalizeAddress(to);
  if (target === null) throw errors.invalidAddress('to', to);

  const derived = deriveUserAddress(derivationIndex);
  if (derived !== from.toLowerCase()) {
    throw errors.badRequest(
      `derivationIndex ${derivationIndex} 로 만든 주소가 from 과 다릅니다`,
      { derived, from: from.toLowerCase() },
    );
  }

  /* 자기 자신에게 보내는 것은 막습니다. 컨트랙트는 통과시키지만 **키만 태우고
     아무것도 옮기지 않습니다** — Spring 은 정산이 끝난 줄 알고, 그 거래는 키가
     영구히 소비돼 다시 시도할 수도 없습니다. 구매자와 판매자가 같은 거래는
     애초에 있으면 안 되는 값이라 여기서 끊습니다. */
  if (derived === target) {
    throw errors.badRequest('from 과 to 가 같습니다', { address: derived, tradeId });
  }

  const key = operationKeyOf(operationKey);
  if (await isTransferExecuted(derived, key)) {
    logger.info(
      `캣머니 전송 건너뜀 (이미 처리됨) ${amount} ${derived} → ${target} ` +
        `trade=${tradeId} key=${short(key)}`,
    );
    return { status: 'ALREADY_DONE', txHash: null };
  }

  /* 정지 스위치를 미리 봅니다. `transferWithKey` 는 `whenNotPaused` 라 켜져 있으면
     체인에서 revert 됩니다 — 그냥 보내면 202 를 돌려준 뒤 10초쯤 지나서야 실패가
     드러나고, 그동안 Spring 은 정산이 진행 중인 줄 압니다. */
  if (await isPaused()) throw errors.contractPaused('캣머니 전송');

  /* 잔액도 미리 봅니다. 소각과 같은 이유이고, 진짜 방어는 컨트랙트가 합니다 —
     확인과 전송 사이에 잔액이 바뀔 수 있습니다. */
  const value = BigInt(amount);
  if ((await balanceOf(derived)) < value) {
    throw errors.insufficientBalance(derived);
  }

  const txHash = await transferAs(derivationIndex, target, value, key);
  logger.info(
    `캣머니 전송 ${amount} ${derived} → ${target} trade=${tradeId} ` +
      `key=${short(key)} tx=${short(txHash)}`,
  );
  return { status: 'PENDING', txHash };
}
