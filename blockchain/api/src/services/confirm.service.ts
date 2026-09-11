import { getTxStatus } from '../chain/tx';
import { hashOf, issuedTicket, ticketSbtAddress } from '../chain/contracts/ticketSbt';
import { env } from '../config';
import { dbEnabled } from '../db/pool';
import {
  findMinting,
  markBurnTx,
  markIssueResult,
  markIssueSent,
  missingColumns,
} from '../db/ticketRepo';
import { logger, short } from '../shared/logger';
import { confirmDuration, sweepProcessed, txDropped, watchingCount } from '../metrics';

/**
 * 티켓 확정 감시 — 체인에 실린 걸 확인해서 Spring DB 에 기록합니다. (DESIGN.md 1장 예외)
 *
 * 쓰기는 `202` 로 먼저 끝나고 블록은 10초 뒤에 옵니다. 그 10초를 **Spring 대신
 * 우리가 기다립니다.** 결제 직후 발행이 유저에게 실패로 보이면 안 되기 때문입니다.
 *
 * ── 두 갈래를 같이 돌립니다 ───────────────────────────────────────
 *
 *   ① 추적   방금 보낸 tx 를 메모리에 들고 영수증을 확인합니다. 빠릅니다
 *   ② 훑기   `MINTING` 인 행을 DB 에서 읽어 체인에 직접 물어봅니다. 느리지만 안 잃습니다
 *
 * **①만 두면 안 됩니다.** 우리가 재시작하면 추적 목록이 통째로 사라지고, 그 티켓들은
 * 영원히 대기 상태로 남습니다. ②가 그걸 걷어냅니다 — 드롭된 트랜잭션도 같이.
 *
 * ── 대상은 `nft_tickets` 입니다 ───────────────────────────────────
 * 2026-09-08 에 바로잡았습니다. 그전에는 `tickets` 를 보고 있었는데 그 테이블에는
 * 체인 컬럼이 하나도 없었습니다. 상태도 `nft_mint_status` 로 바뀌어 포카 감시와
 * 완전히 같은 모양이 됐습니다. (`db/ticketRepo.ts`)
 */

/** 영수증 확인 주기. 블록이 10초라 이보다 촘촘하게 볼 이유가 없습니다. */
const TICK_MS = 3_000;
/** 훑기 주기. 재시작 복구용이라 자주 돌 필요가 없습니다. */
const SWEEP_MS = 60_000;
/** 방금 보낸 건 아직 블록에 없습니다. 이만큼 지난 행만 훑습니다. */
const SWEEP_AFTER_SECONDS = 30;
/** 한 번에 훑을 최대 행 수. DB 를 오래 붙잡지 않기 위해서입니다. */
const SWEEP_LIMIT = 100;
/**
 * 이만큼 지나도 체인이 트랜잭션을 모르면 드롭으로 봅니다.
 *
 * 짧게 잡으면 아직 대기 중인 걸 실패로 만듭니다. SSAFY 체인은 블록이 10초라
 * 5분이면 충분히 여유롭습니다.
 */
const DROP_AFTER_MS = 5 * 60_000;

interface Watched {
  ticketKey: string;
  tokenId: string;
  since: number;
}

/** txHash → 무엇을 기다리는 중인지. 재시작하면 사라집니다 (그래서 훑기가 있습니다). */
const watching = new Map<string, Watched>();

let tickTimer: NodeJS.Timeout | null = null;
let sweepTimer: NodeJS.Timeout | null = null;
let ticking = false;
let sweeping = false;

/** 배포 주소. 없으면 기록을 건너뜁니다 — 부르는 쪽이 이미 확인했어야 합니다. */
function contractAddress(): string | null {
  return ticketSbtAddress();
}

/**
 * 발행 트랜잭션을 추적 목록에 올리고, **DB 를 바로 `MINTING` 으로 옮깁니다.**
 *
 * 지금 남겨야 우리가 재시작했을 때 훑기가 "어느 트랜잭션을 기다리던 행인지" 를 압니다.
 *
 * DB 쓰기가 실패해도 발행 자체는 성공입니다. `202` 를 실패로 바꾸지 않고 넘어갑니다 —
 * 훑기가 나중에 체인에서 직접 확인해 걷어냅니다.
 *
 * DB 가 꺼져 있으면 아무것도 하지 않습니다 — 체인만으로 개발할 때의 경로입니다.
 */
export async function watchIssue(
  ticketKey: string,
  tokenId: string,
  txHash: string,
): Promise<void> {
  if (!dbEnabled()) return;

  watching.set(txHash, { ticketKey, tokenId, since: Date.now() });
  watchingCount.set({ kind: 'ticket' }, watching.size);

  const address = contractAddress();
  if (address === null) return;

  try {
    await markIssueSent(ticketKey, tokenId, env.CHAIN_ID, address, txHash);
  } catch (error) {
    logger.error(`전송 기록 실패 ticket=${ticketKey} — 훑기가 따라잡습니다`, error);
  }
}

/**
 * 이미 체인에 있는 발행을 바로 기록합니다.
 *
 * `ALREADY_ISSUED` 경로입니다 — 새 트랜잭션이 없어 기다릴 것도 없습니다.
 * 큐가 메시지를 재전달하면(at-least-once 는 정상 동작입니다) 여기로 옵니다.
 *
 * `MINTING` 을 거치지 않고 `PENDING` 에서 바로 `MINTED` 가 됩니다.
 */
export async function recordAlreadyIssued(ticketKey: string, tokenId: string): Promise<void> {
  if (!dbEnabled()) return;
  await write(ticketKey, 'MINTED', tokenId, null);
}

/**
 * 소각(예매 취소) 트랜잭션을 기록합니다.
 *
 * 상태는 건드리지 않습니다 — 취소의 상태 전이는 Spring 이 소유합니다.
 * 우리는 어느 트랜잭션으로 태웠는지만 남깁니다.
 */
export async function recordBurn(tokenId: string, burnTxHash: string): Promise<void> {
  if (!dbEnabled()) return;

  const address = contractAddress();
  if (address === null) return;

  try {
    await markBurnTx(tokenId, env.CHAIN_ID, address, burnTxHash);
  } catch (error) {
    logger.error(`소각 기록 실패 #${tokenId}`, error);
  }
}

/** DB 쓰기는 실패해도 프로세스를 죽이지 않습니다. 훑기가 다음 번에 따라잡습니다. */
async function write(
  ticketKey: string,
  status: 'MINTED' | 'FAILED',
  tokenId: string,
  txHash: string | null,
): Promise<void> {
  const address = contractAddress();
  if (address === null) return;

  try {
    const changed = await markIssueResult(ticketKey, status, tokenId, env.CHAIN_ID, address, txHash);
    if (changed) {
      logger.info(`확정 기록 ${status} ticket=${ticketKey}`);
    } else {
      /* 대기 상태가 아니어서 안 바뀌었습니다. 이미 기록됐거나 Spring 이 상태를
         옮긴 것이라 정상입니다 — 조건부 UPDATE 가 덮어쓰기를 막은 자리입니다. */
      logger.info(`확정 기록 건너뜀 (대기 아님) ticket=${ticketKey}`);
    }
  } catch (error) {
    logger.error(`확정 기록 실패 ticket=${ticketKey} — 훑기가 다시 시도합니다`, error);
  }
}

/** ① 추적 중인 트랜잭션의 영수증을 봅니다. */
async function tick(): Promise<void> {
  if (ticking || watching.size === 0) return;
  ticking = true;

  try {
    for (const [txHash, item] of [...watching]) {
      let chain;
      try {
        chain = await getTxStatus(txHash);
      } catch (error) {
        logger.warn(`영수증 조회 실패 tx=${short(txHash)}`, error);
        continue;
      }

      if (!chain.mined) {
        // 너무 오래 안 실리면 손을 뗍니다. 이후는 훑기가 봅니다.
        if (Date.now() - item.since > DROP_AFTER_MS) {
          logger.warn(
            `추적 포기 (${DROP_AFTER_MS / 1000}초 초과) tx=${short(txHash)} — 훑기로 넘깁니다`,
          );
          watching.delete(txHash);
          watchingCount.set({ kind: 'ticket' }, watching.size);
        }
        continue;
      }

      watching.delete(txHash);
      watchingCount.set({ kind: 'ticket' }, watching.size);

      /* `AlreadyIssued` 는 실패가 아닙니다. 같은 티켓을 다른 트랜잭션이 이미
         발행했다는 뜻이라, 결과적으로 그 티켓은 체인에 있습니다. (tx.service 와 같은 판단) */
      const done = chain.success || chain.revertErrorName === 'AlreadyIssued';

      if (!done) {
        logger.error(
          `발행 실패 ticket=${item.ticketKey} tx=${short(txHash)} — ${chain.revertReason ?? '사유 불명'}`,
        );
      }
      // 전송부터 영수증 확인까지. 블록이 10초라 20~30초가 정상 범위다
      confirmDuration.observe(
        { kind: 'ticket', result: done ? 'minted' : 'failed' },
        (Date.now() - item.since) / 1000,
      );

      await write(item.ticketKey, done ? 'MINTED' : 'FAILED', item.tokenId, txHash);
    }
  } finally {
    ticking = false;
  }
}

/**
 * ② `MINTING` 인 행을 체인에 직접 물어봅니다.
 *
 * 재시작으로 추적 목록을 잃었거나, 트랜잭션이 드롭됐거나, DB 쓰기가 실패했던
 * 건들이 전부 여기로 걷힙니다. **이 서비스의 안전망입니다.**
 */
async function sweep(): Promise<void> {
  if (sweeping) return;
  sweeping = true;

  try {
    const rows = await findMinting(SWEEP_AFTER_SECONDS, SWEEP_LIMIT);
    if (rows.length === 0) return;

    logger.info(`훑기 — 대기 ${rows.length}건`);

    for (const row of rows) {
      // 추적 중이면 ①이 처리합니다.
      if (row.mintTxHash !== null && watching.has(row.mintTxHash)) continue;

      const probe = await issuedTicket(hashOf(row.ticketKey));
      if (probe.issued) {
        // 추적이 놓친 것을 훑기가 주웠다. 이 값이 꾸준히 오르면 ①이 제 몫을 못 하고 있다는 뜻이다
        sweepProcessed.inc({ kind: 'ticket' });
        await write(row.ticketKey, 'MINTED', probe.tokenId.toString(), row.mintTxHash);
        continue;
      }

      /* 체인에 없습니다. 트랜잭션이 아직 대기 중일 수도 있어서, 영수증까지 없고
         충분히 오래된 것만 실패로 내립니다. 성급하게 FAILED 로 만들면 곧 실릴
         트랜잭션을 죽은 것으로 처리하게 됩니다. */
      if (row.mintTxHash === null) continue;

      const chain = await getTxStatus(row.mintTxHash);
      if (chain.found) continue; // 아직 살아 있습니다

      logger.error(`트랜잭션 드롭 ticket=${row.ticketKey} tx=${short(row.mintTxHash)}`);
      // 🔴 0 이어야 정상인 값. 1건이라도 오르면 티켓이 유실된 것이라 알림 대상이다
      txDropped.inc({ kind: 'ticket' });
      await write(row.ticketKey, 'FAILED', tokenIdText(row.ticketKey), row.mintTxHash);
    }
  } catch (error) {
    logger.error('훑기 실패 — 다음 주기에 다시 시도합니다', error);
  } finally {
    sweeping = false;
  }
}

/** 체인에 없는 티켓의 번호도 키에서 계산됩니다. 그 키가 갖게 될 번호입니다. */
function tokenIdText(ticketKey: string): string {
  return BigInt(hashOf(ticketKey)).toString();
}

/**
 * 감시를 시작합니다. `main.ts` 가 기동할 때 한 번 부릅니다.
 *
 * 기동 시 **스키마를 먼저 확인**합니다. 컬럼이 없으면 그 자리에서 알립니다 —
 * 없으면 첫 티켓 발행 때 조용히 깨지고, 그때는 이미 유저가 결제를 끝낸 뒤입니다.
 */
export async function startConfirmWatcher(): Promise<string[]> {
  if (!dbEnabled()) {
    logger.warn('DATABASE_URL 이 없습니다 — 확정 기록이 꺼진 채로 돕니다 (티켓이 대기로 남습니다)');
    return [];
  }

  const missing = await missingColumns();
  if (missing.length > 0) {
    logger.error(`Spring DB 스키마가 기대와 다릅니다 — 없는 컬럼: ${missing.join(', ')}`);
    return missing;
  }

  tickTimer = setInterval(() => void tick(), TICK_MS);
  sweepTimer = setInterval(() => void sweep(), SWEEP_MS);

  // 기동 직후 한 번 훑습니다. 죽어 있는 동안 확정된 것들을 바로 걷어냅니다.
  await sweep();

  logger.info(`확정 감시 시작 — 영수증 ${TICK_MS / 1000}초 · 훑기 ${SWEEP_MS / 1000}초`);
  return [];
}

export function stopConfirmWatcher(): void {
  if (tickTimer) clearInterval(tickTimer);
  if (sweepTimer) clearInterval(sweepTimer);
  tickTimer = null;
  sweepTimer = null;
}
