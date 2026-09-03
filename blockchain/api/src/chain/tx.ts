import { CatMoney__factory } from '@teacat/contracts';
import { provider } from './provider';

/**
 * 트랜잭션 확정 상태 조회.
 *
 * 주의: `ethers` 를 import 하는 곳은 `chain/` 안뿐입니다. (DESIGN.md 4-1)
 */

/** 영수증의 로그를 보고 알아낸 작업 종류. 우리가 모르는 컨트랙트면 `UNKNOWN`. */
export type TxOperation = 'CATMONEY_MINT' | 'CATMONEY_BURN' | 'CATMONEY_TRANSFER' | 'UNKNOWN';

/** 이벤트 이름 → 작업 종류. 컨트랙트가 늘면 여기에 한 줄씩 붙입니다. */
const OPERATION_BY_EVENT: Record<string, TxOperation> = {
  Minted: 'CATMONEY_MINT',
  Burned: 'CATMONEY_BURN',
  TransferredWithKey: 'CATMONEY_TRANSFER',
};

const catMoney = CatMoney__factory.createInterface();

export interface ChainTxStatus {
  /** 체인이 이 해시를 모르면 false. 드롭됐거나 애초에 없는 해시입니다 */
  found: boolean;
  /** 블록에 실렸는지. false 면 아직 대기 중입니다 */
  mined: boolean;
  /** 실렸고 revert 되지 않았는지 */
  success: boolean;
  blockNumber: number | null;
  operation: TxOperation | null;
  /** revert 사유. 알아내지 못하면 null */
  revertReason: string | null;
}

/** 영수증 로그에서 무슨 작업이었는지 알아냅니다. */
function operationOf(logs: readonly { topics: readonly string[]; data: string }[]): TxOperation {
  for (const log of logs) {
    let parsed;
    try {
      // 우리 컨트랙트가 아니면 파싱에 실패합니다. 정상입니다.
      parsed = catMoney.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      continue;
    }
    const operation = parsed && OPERATION_BY_EVENT[parsed.name];
    if (operation) return operation;
  }
  return 'UNKNOWN';
}

/**
 * revert 사유를 캐냅니다.
 *
 * 영수증에는 이유가 안 담깁니다. 같은 블록에서 그 호출을 **다시 실행해보고**
 * 튀어나오는 에러를 읽는 것이 유일한 방법입니다. 실패해도 조회 자체는
 * 성공해야 하므로 조용히 포기합니다.
 */
async function revertReasonOf(hash: string, blockNumber: number): Promise<string | null> {
  try {
    const tx = await provider.getTransaction(hash);
    if (!tx) return null;

    await provider.call({
      to: tx.to,
      from: tx.from,
      data: tx.data,
      value: tx.value,
      blockTag: blockNumber,
    });
    return null; // 다시 해보니 성공했다면 알아낼 수 없습니다
  } catch (error) {
    const e = error as { data?: string; shortMessage?: string; reason?: string; message?: string };

    /* 커스텀 에러를 풀어봅니다.
       우리 컨트랙트는 `OperationAlreadyExecuted` 처럼 커스텀 에러를 쓰고, OZ 도
       `ERC20InsufficientBalance` 를 씁니다. ABI 없이 읽으면 전부
       "unknown custom error" 로만 나와서 Spring 이 원인을 구분할 수 없습니다. */
    if (typeof e.data === 'string' && e.data.length > 2) {
      try {
        const parsed = catMoney.parseError(e.data);
        if (parsed) {
          const args = parsed.args.length > 0 ? `(${parsed.args.join(', ')})` : '';
          return `${parsed.name}${args}`;
        }
      } catch {
        // 우리가 모르는 에러입니다. 아래 일반 메시지로 넘어갑니다.
      }
    }

    return e.reason ?? e.shortMessage ?? e.message ?? null;
  }
}

export async function getTxStatus(hash: string): Promise<ChainTxStatus> {
  const empty: ChainTxStatus = {
    found: false,
    mined: false,
    success: false,
    blockNumber: null,
    operation: null,
    revertReason: null,
  };

  const [tx, receipt] = await Promise.all([
    provider.getTransaction(hash),
    provider.getTransactionReceipt(hash),
  ]);

  if (!tx && !receipt) return empty;

  // 트랜잭션은 있는데 영수증이 없으면 아직 블록에 안 실린 것입니다.
  if (!receipt) return { ...empty, found: true };

  const success = receipt.status === 1;

  return {
    found: true,
    mined: true,
    success,
    blockNumber: receipt.blockNumber,
    operation: success ? operationOf(receipt.logs) : null,
    revertReason: success ? null : await revertReasonOf(hash, receipt.blockNumber),
  };
}
