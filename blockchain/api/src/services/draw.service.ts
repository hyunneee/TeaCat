import {
  assign,
  drawIdOf,
  drawSeedConfigured,
  getDraw,
  inputsHashOf,
  isExpired,
  isRevealable,
  openDraw,
  revealDraw,
  verifiableDrawAddress,
  type DrawInputs,
} from '../chain/contracts/verifiableDraw';
import { errors } from '../shared/errors';
import { logger, short } from '../shared/logger';
import { watchDraw } from './drawWatcher.service';

/**
 * 검증 가능한 추첨. (PHOTOCARD_PLAN.md 4장)
 *
 * **체인이 만드는 것은 난수 하나뿐입니다.** 배정은 그 난수로부터 계산되는 순수
 * 함수라 누가 실행하든 같은 답이 나옵니다 — 그래서 온체인에 두지 않고, Spring 이
 * 계산해도 검증이 성립합니다. 다만 keccak 의존성을 만들지 않으려고 계산은 여기서
 * 해 줍니다 (4-5).
 */

/** 추첨에 넣는 입력. 서비스 경계에서는 문자열로 받습니다 (JSON number 정밀도). */
export interface DrawInputsRequest {
  performanceId: string;
  ticketIds: string[];
  designIds: string[];
  quantities: string[];
}

export interface DrawOpenResult {
  status: 'PENDING';
  txHash: string;
  drawId: string;
  inputsHash: string;
}

export interface DrawRevealResult {
  status: 'PENDING';
  txHash: string;
}

export interface DrawStateResult {
  exists: boolean;
  status: 'OPEN' | 'REVEALED' | 'CANCELED' | null;
  commitBlock: number | null;
  targetBlock: number | null;
  revealable: boolean;
  randomness: string | null;
  inputsHash: string | null;
}

export interface DrawAssignResult {
  randomness: string;
  assignments: { ticketId: string; designId: string }[];
}

function requireReady(): void {
  if (verifiableDrawAddress() === null) throw errors.contractUnavailable('VerifiableDraw');
  // 시드를 파생할 수 없으면 커밋한 것을 영영 공개하지 못합니다. 열기 전에 막습니다.
  if (!drawSeedConfigured()) throw errors.drawNotConfigured();
}

/**
 * 문자열 입력을 체인 타입으로 바꾸면서 **정렬과 합계를 검사합니다.**
 *
 * 정렬을 강제하는 이유는 `inputsHash` 가 순서에 민감하기 때문입니다. 커밋과 배정에서
 * 순서가 달라지면 해시가 어긋나 `INPUTS_MISMATCH` 로 떨어지는데, 그 시점엔 이미
 * 커밋 트랜잭션이 체인에 남아 있어 **그 추첨을 통째로 버려야 합니다.**
 * 열기 전에 여기서 막는 편이 훨씬 쌉니다.
 */
function toChainInputs(request: DrawInputsRequest): DrawInputs {
  const ticketIds = request.ticketIds.map(BigInt);
  const designIds = request.designIds.map(BigInt);
  const quantities = request.quantities.map(BigInt);

  if (designIds.length !== quantities.length) {
    throw errors.badRequest('designIds 와 quantities 의 길이가 다릅니다');
  }
  if (!isAscending(ticketIds)) {
    throw errors.badRequest('ticketIds 는 중복 없이 오름차순이어야 합니다');
  }
  if (!isAscending(designIds)) {
    throw errors.badRequest('designIds 는 중복 없이 오름차순이어야 합니다');
  }

  const total = quantities.reduce((sum, quantity) => sum + quantity, 0n);
  if (total !== BigInt(ticketIds.length)) {
    throw errors.badRequest(
      `수량 합계(${total})가 참여자 수(${ticketIds.length})와 다릅니다`,
      { total: total.toString(), participants: ticketIds.length },
    );
  }

  return { performanceId: BigInt(request.performanceId), ticketIds, designIds, quantities };
}

function isAscending(values: bigint[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (values[i]! <= values[i - 1]!) return false;
  }
  return true;
}

/**
 * 추첨을 엽니다 — 커밋.
 *
 * 열자마자 **자동 리빌 감시에 올립니다.** 블록해시가 256블록(약 42분)만 남아서
 * 사람이 부르는 구조로 두면 그 시한을 놓친 추첨이 죽습니다.
 */
export async function openDrawFor(
  drawKey: string,
  request: DrawInputsRequest,
): Promise<DrawOpenResult> {
  requireReady();

  const inputs = toChainInputs(request);

  /* 사전 확인은 **확정된 상태만** 봅니다. 확정 전 중복 요청은 둘 다 통과해
     두 번째 트랜잭션이 나가고, 컨트랙트가 `DrawAlreadyExists` 로 거부합니다. */
  const existing = await getDraw(drawKey);
  if (existing.exists) throw errors.drawAlreadyExists(drawKey);

  const txHash = await openDraw(drawKey, inputs);

  logger.info(`추첨 커밋 draw=${drawKey} tx=${short(txHash)}`);
  watchDraw(drawKey);

  return {
    status: 'PENDING',
    txHash,
    drawId: drawIdOf(drawKey),
    inputsHash: inputsHashOf(inputs),
  };
}

/**
 * 시드를 공개해 난수를 확정합니다 — 리빌.
 *
 * **보통은 감시가 자동으로 부릅니다.** 이 엔드포인트는 수동 개입용으로 남깁니다 —
 * 감시가 죽어 있거나 즉시 확정해야 할 때 씁니다.
 */
export async function revealDrawFor(drawKey: string): Promise<DrawRevealResult> {
  requireReady();

  const draw = await getDraw(drawKey);
  if (!draw.exists) throw errors.drawNotFound(drawKey);
  if (draw.canceled) throw errors.drawCanceled(drawKey);
  if (draw.revealed) throw errors.drawAlreadyRevealed(drawKey);

  // 되살릴 수 없는 것과 조금 뒤에 되는 것을 갈라서 알려줍니다.
  if (await isExpired(draw)) throw errors.drawExpired(drawKey);
  if (!(await isRevealable(draw))) throw errors.drawTooEarly(draw.targetBlock);

  const txHash = await revealDraw(drawKey);
  logger.info(`추첨 공개 draw=${drawKey} tx=${short(txHash)}`);

  return { status: 'PENDING', txHash };
}

/**
 * 추첨 상태.
 *
 * 열린 적 없어도 `exists: false` 로 200 입니다. 404 로 만들면 "아직 안 열림" 과
 * "경로가 틀림" 을 Spring 이 구분하지 못합니다.
 */
export async function getDrawState(drawKey: string): Promise<DrawStateResult> {
  requireReady();

  const draw = await getDraw(drawKey);
  if (!draw.exists) {
    return {
      exists: false,
      status: null,
      commitBlock: null,
      targetBlock: null,
      revealable: false,
      randomness: null,
      inputsHash: null,
    };
  }

  return {
    exists: true,
    status: draw.canceled ? 'CANCELED' : draw.revealed ? 'REVEALED' : 'OPEN',
    commitBlock: draw.commitBlock,
    targetBlock: draw.targetBlock,
    revealable: await isRevealable(draw),
    randomness: draw.randomness,
    inputsHash: draw.inputsHash,
  };
}

/**
 * 배정 계산. **트랜잭션이 없습니다.**
 *
 * 보낸 입력으로 `inputsHash` 를 다시 계산해 **체인에 박힌 값과 대조**합니다.
 * 이 대조가 곧 "커밋 이후 참여자 목록이 바뀌지 않았다" 의 증명입니다 (4-3).
 *
 * 같은 입력이면 언제 불러도 같은 답입니다 — 확정된 난수로 도는 순수 함수입니다.
 */
export async function assignFor(
  drawKey: string,
  request: DrawInputsRequest,
): Promise<DrawAssignResult> {
  requireReady();

  const draw = await getDraw(drawKey);
  if (!draw.exists) throw errors.drawNotFound(drawKey);
  if (draw.canceled) throw errors.drawCanceled(drawKey);
  if (!draw.revealed || draw.randomness === null) throw errors.drawNotRevealed(drawKey);

  const inputs = toChainInputs(request);
  const inputsHash = inputsHashOf(inputs);
  if (inputsHash !== draw.inputsHash) {
    // 정렬 순서 하나만 달라도 여기서 걸립니다. 그게 이 검사의 목적입니다.
    throw errors.inputsMismatch({ expected: draw.inputsHash, actual: inputsHash });
  }

  return {
    randomness: draw.randomness,
    assignments: assign(draw.randomness, inputs).map((row) => ({
      ticketId: row.ticketId.toString(),
      designId: row.designId.toString(),
    })),
  };
}
