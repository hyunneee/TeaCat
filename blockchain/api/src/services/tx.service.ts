import { getTxStatus, type TxOperation } from '../chain/tx';
import { errors } from '../shared/errors';

/**
 * 컨트랙트가 "이미 처리된 작업" 이라고 거부할 때 쓰는 에러 이름.
 *
 * 이건 실패가 아니라 **성공의 다른 모양**입니다 — 그 작업은 다른 트랜잭션이
 * 이미 해냈다는 뜻이니까요. 아래에서 ALREADY_DONE 으로 바꿔 내려줍니다.
 */
const ALREADY_EXECUTED = 'OperationAlreadyExecuted';

export interface TxReport {
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'ALREADY_DONE';
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

  /* 블록이 10초라, 같은 요청이 연달아 오면 앞의 트랜잭션이 아직 확정되지 않아
     서비스의 사전 확인(isMintExecuted 등)을 둘 다 통과합니다. 그러면 두 번째
     트랜잭션이 나가고 컨트랙트가 거부합니다 — **자산은 안전하지만**, 그걸 그대로
     FAILED 로 내리면 Spring 이 정상 결제를 실패로 오인합니다.
     실제로 확정 전 중복 요청에서 재현한 경우입니다. */
  if (!chain.success && chain.revertErrorName === ALREADY_EXECUTED) {
    return {
      status: 'ALREADY_DONE',
      txHash,
      blockNumber: chain.blockNumber,
      result: null,
      error: null,
    };
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
