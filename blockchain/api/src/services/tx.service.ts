import { getTxStatus, type TxOperation } from '../chain/tx';
import { errors } from '../shared/errors';

export interface TxReport {
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  txHash: string;
  /** 블록에 실렸으면 번호, 아니면 null */
  blockNumber: number | null;
  /** 확정됐을 때 무슨 작업이었는지. 그 외에는 null */
  result: { operation: TxOperation; tokenId: string | null } | null;
  /** 실패 사유. 실패가 아니면 null */
  error: { code: string; message: string } | null;
}

/**
 * 쓰기 API 의 **최종 성공 여부**를 여기서 확인합니다. (DESIGN.md 4-2, 7장)
 *
 * `FAILED` 는 서버 장애가 아니라 정상적인 조회 결과입니다.
 * 체인의 revert 를 500 으로 던지지 않습니다.
 */
export async function reportTx(txHash: string): Promise<TxReport> {
  const chain = await getTxStatus(txHash);

  // 체인이 모르는 해시입니다. 드롭됐거나 애초에 없습니다.
  if (!chain.found) throw errors.txNotFound(txHash);

  if (!chain.mined) {
    return { status: 'PENDING', txHash, blockNumber: null, result: null, error: null };
  }

  if (!chain.success) {
    return {
      status: 'FAILED',
      txHash,
      blockNumber: chain.blockNumber,
      result: null,
      error: {
        code: 'CHAIN_REVERTED',
        message: chain.revertReason ?? '컨트랙트가 실행을 거부했습니다',
      },
    };
  }

  return {
    status: 'CONFIRMED',
    txHash,
    blockNumber: chain.blockNumber,
    // tokenId 는 티켓(M1)이 붙으면 채웁니다. 캣머니에는 해당이 없습니다.
    result: { operation: chain.operation ?? 'UNKNOWN', tokenId: null },
    error: null,
  };
}
