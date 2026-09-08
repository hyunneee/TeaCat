import type { LogDescription } from 'ethers';
import { CatMoney__factory, TicketSBT__factory } from '@teacat/contracts';
import { provider } from './provider';

/**
 * 트랜잭션 확정 상태 조회.
 *
 * 주의: `ethers` 를 import 하는 곳은 `chain/` 안뿐입니다. (DESIGN.md 4-1)
 */

/** 영수증의 로그를 보고 알아낸 작업 종류. 우리가 모르는 컨트랙트면 `UNKNOWN`. */
export type TxOperation =
  | 'CATMONEY_MINT'
  | 'CATMONEY_BURN'
  | 'CATMONEY_TRANSFER'
  | 'TICKET_ISSUE'
  | 'TICKET_BURN'
  | 'UNKNOWN';

/** 이벤트 이름 → 작업 종류. 컨트랙트가 늘면 여기에 한 줄씩 붙입니다. */
const OPERATION_BY_EVENT: Record<string, TxOperation> = {
  Minted: 'CATMONEY_MINT',
  Burned: 'CATMONEY_BURN',
  TransferredWithKey: 'CATMONEY_TRANSFER',
  TicketIssued: 'TICKET_ISSUE',
  TicketBurned: 'TICKET_BURN',
};

/**
 * 우리 컨트랙트들의 인터페이스.
 *
 * 로그와 커스텀 에러를 풀 때 **전부** 시도합니다. 하나만 물려두면 다른 컨트랙트의
 * revert 가 "unknown custom error" 로만 나와서 Spring 이 원인을 구분하지 못합니다.
 */
const INTERFACES = [CatMoney__factory.createInterface(), TicketSBT__factory.createInterface()];

export interface ChainTxStatus {
  /** 체인이 이 해시를 모르면 false. 드롭됐거나 애초에 없는 해시입니다 */
  found: boolean;
  /** 블록에 실렸는지. false 면 아직 대기 중입니다 */
  mined: boolean;
  /** 실렸고 revert 되지 않았는지 */
  success: boolean;
  blockNumber: number | null;
  operation: TxOperation | null;
  /**
   * 이벤트에서 꺼낸 tokenId. 티켓 작업이 아니면 null 입니다.
   *
   * **Spring 이 이 값으로 예매와 얼굴 벡터를 잇습니다.** 발행은 202 로 끝나므로
   * 응답 시점에는 tokenId 가 없습니다 — 확정을 확인할 때 여기서 받습니다.
   */
  tokenId: string | null;
  /** revert 사유. 알아내지 못하면 null */
  revertReason: string | null;
  /**
   * 디코딩된 커스텀 에러 이름. 서비스가 의미를 판단할 때 씁니다.
   *
   * 문자열 메시지를 파싱해서 분기하면 문구를 손대는 순간 조용히 깨집니다.
   * 이름은 따로 들고 나옵니다.
   */
  revertErrorName: string | null;
}

/**
 * 영수증 로그에서 무슨 작업이었는지, 티켓이라면 몇 번인지 알아냅니다.
 *
 * tokenId 는 인자 이름으로 찾습니다. 자리 번호로 세면 이벤트에 인자가 하나
 * 끼어드는 순간 엉뚱한 값이 조용히 내려갑니다.
 */
function decodeLogs(
  logs: readonly { topics: readonly string[]; data: string }[],
): { operation: TxOperation; tokenId: string | null } {
  for (const log of logs) {
    for (const iface of INTERFACES) {
      let parsed: LogDescription | null;
      try {
        // 우리 컨트랙트가 아니면 파싱에 실패합니다. 정상입니다.
        parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      } catch {
        continue;
      }

      const operation = parsed && OPERATION_BY_EVENT[parsed.name];
      if (!parsed || !operation) continue;

      const index = parsed.fragment.inputs.findIndex((input) => input.name === 'tokenId');
      return { operation, tokenId: index === -1 ? null : String(parsed.args[index]) };
    }
  }
  return { operation: 'UNKNOWN', tokenId: null };
}

/**
 * revert 사유를 캐냅니다.
 *
 * 영수증에는 이유가 안 담깁니다. 같은 블록에서 그 호출을 **다시 실행해보고**
 * 튀어나오는 에러를 읽는 것이 유일한 방법입니다. 실패해도 조회 자체는
 * 성공해야 하므로 조용히 포기합니다.
 */
async function revertReasonOf(
  hash: string,
  blockNumber: number,
): Promise<{ reason: string | null; name: string | null }> {
  try {
    const tx = await provider.getTransaction(hash);
    if (!tx) return { reason: null, name: null };

    await provider.call({
      to: tx.to,
      from: tx.from,
      data: tx.data,
      value: tx.value,
      blockTag: blockNumber,
    });
    return { reason: null, name: null }; // 다시 해보니 성공했다면 알아낼 수 없습니다
  } catch (error) {
    const e = error as { data?: string; shortMessage?: string; reason?: string; message?: string };

    /* 커스텀 에러를 풀어봅니다.
       우리 컨트랙트는 `OperationAlreadyExecuted`·`AlreadyIssued` 처럼 커스텀
       에러를 쓰고, OZ 도 `ERC20InsufficientBalance` 를 씁니다. ABI 없이 읽으면
       전부 "unknown custom error" 로만 나와서 Spring 이 원인을 구분할 수 없습니다.

       티켓은 특히 이름이 중요합니다 — 같은 "이미 사용됨" 이라도 입장 재시도면
       성공이고 취소 시도면 실패입니다. 이름으로만 갈립니다. (TicketSBT.sol) */
    if (typeof e.data === 'string' && e.data.length > 2) {
      for (const iface of INTERFACES) {
        try {
          const parsed = iface.parseError(e.data);
          if (parsed) {
            const args = parsed.args.length > 0 ? `(${parsed.args.join(', ')})` : '';
            return { reason: `${parsed.name}${args}`, name: parsed.name };
          }
        } catch {
          // 이 컨트랙트의 에러가 아닙니다. 다음 것을 시도합니다.
        }
      }
    }

    return { reason: e.reason ?? e.shortMessage ?? e.message ?? null, name: null };
  }
}

export async function getTxStatus(hash: string): Promise<ChainTxStatus> {
  const empty: ChainTxStatus = {
    found: false,
    mined: false,
    success: false,
    blockNumber: null,
    operation: null,
    tokenId: null,
    revertReason: null,
    revertErrorName: null,
  };

  const [tx, receipt] = await Promise.all([
    provider.getTransaction(hash),
    provider.getTransactionReceipt(hash),
  ]);

  if (!tx && !receipt) return empty;

  // 트랜잭션은 있는데 영수증이 없으면 아직 블록에 안 실린 것입니다.
  if (!receipt) return { ...empty, found: true };

  const success = receipt.status === 1;
  const revert = success
    ? { reason: null, name: null }
    : await revertReasonOf(hash, receipt.blockNumber);

  /* revert 된 트랜잭션은 이벤트를 남기지 않습니다. 그래서 실패한 tx 는 무슨
     작업이었는지도, tokenId 도 알 수 없습니다 — 에러 이름만 남습니다. */
  const decoded = success ? decodeLogs(receipt.logs) : { operation: null, tokenId: null };

  return {
    found: true,
    mined: true,
    success,
    blockNumber: receipt.blockNumber,
    operation: decoded.operation,
    tokenId: decoded.tokenId,
    revertReason: revert.reason,
    revertErrorName: revert.name,
  };
}
