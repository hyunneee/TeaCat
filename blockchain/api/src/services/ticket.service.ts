import {
  burnTicket,
  getTicket,
  hashOf,
  issue,
  issuedTicket,
  isIssuePaused,
  tokenIdOf,
  ticketSbtAddress,
} from '../chain/contracts/ticketSbt';
import { normalizeAddress } from '../chain/address';
import { recordAlreadyIssued, watchIssue } from './confirm.service';
import { errors } from '../shared/errors';
import { logger, short } from '../shared/logger';

/**
 * 티켓 유스케이스.
 *
 * **좌석·공연·입장 여부는 Spring 의 티켓 DB 가 소유합니다.** 체인에 있는 것은
 * `tokenId`(= `ticketKey` 의 해시)와 `owner` 뿐입니다. (DESIGN.md 1장)
 *
 * **얼굴 벡터는 이 서비스로 오지 않습니다.**
 */

export interface TicketResult {
  tokenId: string;
  /** 지금 소유자. **소각(예매 취소)됐으면 null** 입니다 */
  owner: string | null;
  burned: boolean;
}

/**
 * `ticketKey` 로 발행 결과를 되찾은 것.
 *
 * `issued` 가 false 면 나머지는 의미가 없습니다 — 발행된 적이 없다는 뜻입니다.
 */
export interface TicketLookupResult {
  issued: boolean;
  tokenId: string | null;
  owner: string | null;
  burned: boolean;
}

export interface IssueResult {
  /** 방금 보냈으면 PENDING, 이미 발행돼 있었으면 ALREADY_ISSUED */
  status: 'PENDING' | 'ALREADY_ISSUED';
  /** ALREADY_ISSUED 면 새로 보낸 트랜잭션이 없어 null 입니다 */
  txHash: string | null;
  /**
   * `ticketKey` 에서 계산한 번호. **두 경우 모두 채워집니다.**
   *
   * 주의: `PENDING` 이면 이 번호는 **아직 체인에 없습니다.** 그 티켓이 갖게 될
   * 번호일 뿐이라, 발행이 실패하면 그런 토큰은 생기지 않습니다. 입장 판정 전에
   * `GET /internal/tx/{txHash}` 로 확정을 확인해야 합니다.
   */
  tokenId: string;
}

export interface BurnResult {
  status: 'PENDING' | 'ALREADY_DONE';
  txHash: string | null;
  tokenId: string;
}

/* 로그에 `ticketKey` **원문을 남기지 않습니다.** 해싱된 값만 앞부분을 잘라 남깁니다.
   그 자리에 무엇이 들어올지 우리가 정하지 못하기 때문입니다 — 캣머니에서는
   실제로 개인키를 붙여넣은 사고가 있었습니다. (DESIGN.md 5-1)
   해시는 온체인 이벤트의 topic 과 같은 값이라 대사(reconciliation)에도 그대로 씁니다. */

/** 컨트랙트가 배포돼 있는지. 없으면 여기서 멈춥니다 — 조용히 넘기면 안 됩니다. */
function requireDeployed(): void {
  if (ticketSbtAddress() === null) throw errors.contractUnavailable('TicketSBT');
}

export async function getTicketState(tokenId: bigint): Promise<TicketResult> {
  requireDeployed();

  const ticket = await getTicket(tokenId);
  // 발행된 적 없는 번호입니다. 소각된 번호와는 다릅니다 — 그쪽은 200 으로 내려갑니다.
  if (!ticket.issued) throw errors.ticketNotFound(tokenId.toString());

  return {
    tokenId: tokenId.toString(),
    owner: ticket.owner,
    burned: ticket.owner === null,
  };
}

/**
 * `ticketKey` 로 발행 결과를 찾습니다.
 *
 * 발행 요청을 보냈는데 **응답을 못 받았을 때 결과를 복구**하는 용도입니다.
 * 이게 없으면 Spring 에게 남는 선택지가 "재시도해서 두 장 발행되거나, 재시도
 * 안 해서 결제만 되고 티켓이 없거나" 뿐입니다 — 온체인의 `tokenId`·`owner`
 * 만으로는 어느 토큰이 어느 예매 건인지 구분되지 않습니다.
 *
 * 발행 전이어도 `200` 에 `issued: false` 로 내려갑니다. 404 로 만들면
 * "아직 안 됨" 과 "경로가 틀림" 을 Spring 이 구분하지 못합니다.
 */
export async function findTicketByKey(ticketKey: string): Promise<TicketLookupResult> {
  requireDeployed();

  const { issued, tokenId, owner } = await issuedTicket(hashOf(ticketKey));
  if (!issued) return { issued: false, tokenId: null, owner: null, burned: false };

  return {
    issued: true,
    tokenId: tokenId.toString(),
    owner,
    // 발행됐는데 주인이 없으면 소각된 것입니다 (예매 취소).
    burned: owner === null,
  };
}

/**
 * 발행. 결제가 **완료된 뒤** 부릅니다.
 *
 * 같은 `ticketKey` 가 다시 오면 새 트랜잭션을 보내지 않고 기존 `tokenId` 를
 * 돌려줍니다. 재시도가 안전한 이유입니다. (DESIGN.md 4-3)
 *
 * 취소(소각)된 예매도 `ALREADY_ISSUED` 입니다 — 그 키는 이미 소비됐습니다.
 * 취소표가 다른 사람에게 갈 때는 Spring 이 **새 `ticketKey`** 로 부르고,
 * 당첨자는 새 `tokenId` 를 받습니다.
 *
 * 주의: 사전 확인은 **확정된 상태만** 봅니다. 블록이 10초라, 확정 전에 같은
 *       요청이 또 오면 둘 다 여기를 통과해 두 번째 트랜잭션이 나갑니다.
 *       **티켓은 안전합니다** — 컨트랙트가 `AlreadyIssued` 로 거부하고,
 *       `tx.service` 가 그것을 `ALREADY_DONE` 으로 바꿔 내려줍니다.
 */
export async function issueTicket(ticketKey: string, to: string): Promise<IssueResult> {
  requireDeployed();

  /* 정규식은 모양만 봅니다. 체크섬이 틀린 주소를 그대로 넘기면 ethers 가 던지고
     500 이 됩니다 — 잘못된 건 입력이므로 여기서 400 으로 돌려보냅니다. (chain/address) */
  const owner = normalizeAddress(to);
  if (owner === null) throw errors.invalidAddress('to', to);

  /* 번호가 키에서 나오므로 **보내기 전에** 정해집니다. 순번이었다면 블록이
     확정될 때까지(약 10초) 알 수 없어 응답에 담을 수 없었습니다. */
  const keyHash = hashOf(ticketKey);
  const tokenId = tokenIdOf(ticketKey).toString();

  const existing = await issuedTicket(keyHash);
  if (existing.issued) {
    logger.info(`티켓 발행 건너뜀 (이미 발행됨) key=${short(keyHash)}`);

    /* 이미 체인에 있으니 기다릴 것이 없습니다. 바로 기록합니다.
       소각된 티켓이면 기록하지 않습니다 — 취소된 예매를 다시 요청한 것이라
       Spring 쪽 문제이고, 여기서 SUCCESS 로 덮으면 그게 가려집니다. */
    if (existing.owner !== null) {
      await recordAlreadyIssued(ticketKey, tokenId);
    } else {
      logger.warn(`이미 취소(소각)된 예매의 재발행 요청입니다 key=${short(keyHash)}`);
    }
    return { status: 'ALREADY_ISSUED', txHash: null, tokenId };
  }

  if (await isIssuePaused()) throw errors.contractPaused('티켓 발행');

  const txHash = await issue(owner, keyHash);

  /* 확정을 기다리는 건 **우리**입니다. Spring 은 202 를 받고 끝냅니다.
     블록에 실리면 confirm.service 가 tickets 행을 SUCCESS 로 올립니다. */
  await watchIssue(ticketKey, tokenId, txHash);

  logger.info(`티켓 발행 → ${owner} key=${short(keyHash)} tx=${short(txHash)}`);
  return { status: 'PENDING', txHash, tokenId };
}

/**
 * 소각 — 예매 취소. **tokenId 는 영구 소멸합니다.**
 *
 * 정지 스위치를 보지 않습니다. 사고로 발행을 멈춰도 환불 경로는 살아 있어야
 * 합니다. (DESIGN.md 결정 이력 2026-09-02)
 *
 * 이미 소각된 티켓이면 새 트랜잭션 없이 `ALREADY_DONE` 입니다.
 * 발행된 적 없는 번호는 `404` 입니다 — 재시도로 풀리지 않습니다.
 */
export async function burnTicketById(tokenId: bigint): Promise<BurnResult> {
  requireDeployed();

  const id = tokenId.toString();
  const ticket = await getTicket(tokenId);
  if (!ticket.issued) throw errors.ticketNotFound(id);

  if (ticket.owner === null) {
    logger.info(`티켓 소각 건너뜀 (이미 취소됨) #${id}`);
    return { status: 'ALREADY_DONE', txHash: null, tokenId: id };
  }

  const txHash = await burnTicket(tokenId);
  logger.info(`티켓 소각 #${id} tx=${short(txHash)}`);
  return { status: 'PENDING', txHash, tokenId: id };
}
