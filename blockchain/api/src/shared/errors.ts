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

  /**
   * 주소 모양은 맞는데 EIP-55 체크섬이 틀렸습니다.
   *
   * 정규식은 통과하지만 ethers 가 거부하는 값이라, 안 걸러내면 500 으로 떨어집니다.
   * 잘못된 건 클라이언트 입력이므로 400 입니다.
   */
  invalidAddress: (field: string, value: string) =>
    new AppError(
      'INVALID_ADDRESS',
      `${field} 주소가 올바르지 않습니다. 대소문자가 섞인 주소는 EIP-55 체크섬이 맞아야 합니다 ` +
        '(전부 소문자로 보내셔도 됩니다)',
      400,
      { [field]: value },
    ),

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

  /* ── 포토카드 ──────────────────────────────────────────────── */

  /** 도안이 체인에 등록되지 않았습니다. 발행보다 `registerDesign` 이 먼저입니다. */
  designNotRegistered: (designId: string) =>
    new AppError('DESIGN_NOT_REGISTERED', `도안 ${designId} 이 체인에 등록되지 않았습니다`, 400, {
      designId,
    }),

  /** 한정 수량을 넘깁니다. **재시도로 풀리지 않습니다.** */
  designSoldOut: (designId: string, detail?: unknown) =>
    new AppError('DESIGN_SOLD_OUT', `도안 ${designId} 의 한정 수량을 넘깁니다`, 422, detail),

  /**
   * 이미 카드가 나간 도안이라 수량·메타데이터가 잠겼습니다.
   *
   * 첫 장을 받은 사람에게 "이 그림, 이 수량" 을 약속한 뒤이므로 되돌릴 수 없습니다.
   * 바꿔야 하면 새 도안으로 만듭니다.
   */
  designFrozen: (designId: string) =>
    new AppError(
      'DESIGN_FROZEN',
      `도안 ${designId} 은 이미 발행이 시작돼 수량·이미지를 바꿀 수 없습니다`,
      409,
      { designId },
    ),

  /* ── 추첨 ──────────────────────────────────────────────────── */

  drawNotFound: (drawKey: string) =>
    new AppError('DRAW_NOT_FOUND', `추첨 ${drawKey} 이 열린 적이 없습니다`, 404),

  /** 취소된 추첨의 키도 풀리지 않습니다. 다시 뽑으려면 새 키로 엽니다. */
  drawAlreadyExists: (drawKey: string) =>
    new AppError('DRAW_ALREADY_EXISTS', `추첨 키 ${drawKey} 은 이미 사용됐습니다`, 409),

  /**
   * 대상 블록이 아직 없습니다. **재시도로 풀립니다** — 조금 뒤에 다시 부르면 됩니다.
   *
   * 아래 `drawExpired` 와 반드시 구분해야 합니다. 하나는 기다리면 되고 하나는 끝입니다.
   */
  drawTooEarly: (targetBlock: number) =>
    new AppError('TOO_EARLY', `아직 ${targetBlock} 블록이 생기지 않았습니다`, 409, {
      targetBlock,
    }),

  drawAlreadyRevealed: (drawKey: string) =>
    new AppError('ALREADY_REVEALED', `추첨 ${drawKey} 은 이미 공개됐습니다`, 409),

  drawNotRevealed: (drawKey: string) =>
    new AppError('NOT_REVEALED', `추첨 ${drawKey} 이 아직 공개되지 않았습니다`, 409),

  drawCanceled: (drawKey: string) =>
    new AppError('DRAW_CANCELED', `추첨 ${drawKey} 은 취소됐습니다`, 409),

  /**
   * 블록해시가 사라져 되살릴 수 없습니다. **재시도로 풀리지 않습니다.**
   * 새 `drawKey` 로 다시 열어야 합니다.
   */
  drawExpired: (drawKey: string) =>
    new AppError(
      'BLOCKHASH_EXPIRED',
      `추첨 ${drawKey} 은 블록해시 창(256블록)을 넘겨 공개할 수 없습니다. 새 키로 다시 여세요`,
      410,
    ),

  /**
   * 보낸 입력이 커밋할 때와 다릅니다.
   *
   * **이 검사가 곧 증명입니다** — 커밋 이후 참여자 목록이 바뀌지 않았다는 것을
   * 여기서 확인합니다. 정렬 순서 하나만 달라도 해시가 달라집니다.
   */
  inputsMismatch: (detail?: unknown) =>
    new AppError('INPUTS_MISMATCH', '보낸 입력이 추첨에 커밋된 것과 다릅니다', 400, detail),

  /** 추첨 시드를 파생할 비밀이 없습니다. 서버 설정 문제입니다. */
  drawNotConfigured: () =>
    new AppError('DRAW_NOT_CONFIGURED', 'DRAW_SEED_SECRET 이 설정되지 않았습니다', 503),

  internal: (message = '알 수 없는 오류') => new AppError('INTERNAL', message, 500),
};

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
