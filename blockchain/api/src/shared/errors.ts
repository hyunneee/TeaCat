/**
 * 도메인 에러.
 *
 * 체인의 revert 를 500 으로 던지지 않습니다. Spring 이 분기할 수 있는
 * **코드**로 변환해서 내려줍니다. (DESIGN.md 7장)
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errors = {
  badRequest: (message: string, detail?: unknown) =>
    new AppError('BAD_REQUEST', message, 400, detail),

  unauthorized: (message = '내부 인증에 실패했습니다') =>
    new AppError('UNAUTHORIZED', message, 401),

  notFound: (message: string) => new AppError('NOT_FOUND', message, 404),

  /** 체인이 모르는 트랜잭션. 드롭됐거나 애초에 없는 해시입니다. */
  txNotFound: (txHash: string) =>
    new AppError('TX_NOT_FOUND', `체인에서 ${txHash} 를 찾을 수 없습니다`, 404),

  /** 체인에 붙지 못했을 때. Spring 은 재시도해도 됩니다. */
  chainUnavailable: (detail?: unknown) =>
    new AppError('CHAIN_UNAVAILABLE', '체인에 연결할 수 없습니다', 503, detail),

  /** 잔액이 모자랍니다. Spring 이 확정한 금액과 온체인이 어긋난 상황입니다. */
  insufficientBalance: (address: string) =>
    new AppError('INSUFFICIENT_BALANCE', `${address} 의 캣머니 잔액이 부족합니다`, 422),

  /** 컨트랙트가 아직 배포되지 않았을 때. 재시도해도 배포 전까지는 같습니다. */
  contractUnavailable: (name: string) =>
    new AppError('CONTRACT_UNAVAILABLE', `${name} 이 아직 배포되지 않았습니다`, 503),

  /**
   * 운영자가 정지 스위치를 켜뒀습니다.
   *
   * 보내기 전에 막습니다. 그냥 보내면 202 를 돌려준 뒤 10초쯤 지나 tx 조회에서야
   * 실패가 드러나고, 그동안 Spring 은 정상 처리로 알고 있습니다.
   */
  contractPaused: (what: string) =>
    new AppError('CONTRACT_PAUSED', `${what} 기능이 정지돼 있습니다. 운영자에게 문의하세요`, 503),

  /** 체인에 없는 tokenId 입니다. */
  ticketNotFound: (tokenId: string) =>
    new AppError('TICKET_NOT_FOUND', `티켓 ${tokenId} 이 체인에 없습니다`, 404),

  /**
   * 허용되지 않는 상태 전이. **재시도로 풀리지 않습니다.**
   *
   * "이미 처리됨"(재시도가 성공으로 바뀌는 경우)과 구분해야 합니다 —
   * 그쪽은 200 + `ALREADY_DONE` 으로 내려갑니다.
   */
  invalidTicketState: (tokenId: string, message: string, detail?: unknown) =>
    new AppError('INVALID_TICKET_STATE', `티켓 ${tokenId}: ${message}`, 409, detail),

  internal: (message = '알 수 없는 오류') => new AppError('INTERNAL', message, 500),
};

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
