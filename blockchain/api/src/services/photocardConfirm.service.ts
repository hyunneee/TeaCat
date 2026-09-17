import { getTxStatus } from '../chain/tx';
import {
  findPhotocardIssuance,
  getPhotocardIssueEvents,
  photocardNftAddress,
} from '../chain/contracts/photocardNft';
import { hashOf } from '../chain/hash';
import { env } from '../config';
import { dbEnabled } from '../db/pool';
import {
  findMinting,
  markIssueResults,
  markIssueSent,
  missingColumns,
  type SentPhotocard,
} from '../db/photocardRepo';
import {
  classifyIssueReceipt,
  verifyHistoricalIssue,
  type ExpectedIssue,
  type IssueOutcome,
} from './photocardIssueEvidence';
import { logger, short } from '../shared/logger';
import { confirmDuration, sweepProcessed, txDropped, watchingCount } from '../metrics';

/**
 * 포토카드 확정 감시 — 체인에 실린 걸 확인해 Spring DB 에 기록합니다.
 * (DESIGN.md 1장 예외 · 티켓의 `confirm.service` 와 같은 구조)
 *
 * 쓰기는 `202` 로 먼저 끝나고 블록은 10초 뒤에 옵니다. 그 10초를 **Spring 대신
 * 우리가 기다립니다.**
 *
 * ── 두 갈래를 같이 돌립니다 ───────────────────────────────────────
 *
 *   ① 추적   방금 보낸 tx 를 메모리에 들고 영수증을 확인합니다. 빠릅니다
 *   ② 훑기   `MINTING` 인 행을 DB 에서 읽어 체인에 직접 물어봅니다. 느리지만 안 잃습니다
 *
 * **①만 두면 안 됩니다.** 재시작하면 추적 목록이 통째로 사라지고, 그 카드들은
 * 영원히 `MINTING` 으로 남습니다.
 *
 * ── 티켓과 다른 점 ────────────────────────────────────────────────
 * 한 트랜잭션이 **카드 최대 200장**을 실어 나릅니다. 그래서 추적 단위가 txHash 하나에
 * 키 배열이고, 훑기도 행 단위로 체인에 물어봅니다.
 *
 * `GET /internal/tx/{txHash}` 의 `result.tokenId` 는 여기서 쓰지 않습니다 —
 * 이벤트가 200개라 그중 하나만 담겨 의미가 없습니다.
 */

/** 영수증 확인 주기. 블록이 10초라 이보다 촘촘하게 볼 이유가 없습니다. */
const TICK_MS = 3_000;
/** 훑기 주기. 재시작 복구용이라 자주 돌 필요가 없습니다. */
const SWEEP_MS = 60_000;
/** 방금 보낸 건 아직 블록에 없습니다. 이만큼 지난 행만 훑습니다. */
const SWEEP_AFTER_SECONDS = 30;
/** 한 번에 훑을 최대 행 수. DB 를 오래 붙잡지 않기 위해서입니다. */
const SWEEP_LIMIT = 500;
/** 이만큼 지나도 체인이 트랜잭션을 모르면 드롭으로 봅니다. */
const DROP_AFTER_MS = 5 * 60_000;

interface Watched {
  cards: SentPhotocard[];
  since: number;
}

/** txHash → 어떤 카드들을 기다리는 중인지. 재시작하면 사라집니다 (그래서 훑기가 있습니다). */
const watching = new Map<string, Watched>();

let tickTimer: NodeJS.Timeout | null = null;
let sweepTimer: NodeJS.Timeout | null = null;
let ticking = false;
let sweeping = false;

/**
 * 발행 트랜잭션을 추적 목록에 올리고, **DB 에 바로 `MINTING` 을 남깁니다.**
 *
 * DB 쓰기가 실패해도 발행 자체는 성공입니다. `202` 를 실패로 바꾸지 않고 넘어갑니다 —
 * 훑기가 나중에 체인에서 직접 확인해 걷어냅니다.
 *
 * DB 가 꺼져 있으면 아무것도 하지 않습니다 — 체인만으로 개발할 때의 경로입니다.
 */
export async function watchIssueBatch(cards: SentPhotocard[], txHash: string): Promise<void> {
  if (!dbEnabled()) return;

  watching.set(txHash, { cards, since: Date.now() });
  watchingCount.set({ kind: 'photocard' }, watching.size);

  const address = photocardNftAddress();
  if (address === null) return;

  try {
    const changed = await markIssueSent(cards, env.CHAIN_ID, address, txHash);
    if (changed !== cards.length) {
      /* PENDING 이 아니어서 안 바뀐 행이 있습니다. 이미 기록됐거나 Spring 이 상태를
         옮긴 것이라 대부분 정상이지만, 수가 안 맞으면 알아두는 편이 낫습니다. */
      logger.info(`전송 기록 ${changed}/${cards.length}건 tx=${short(txHash)}`);
    }
  } catch (error) {
    logger.error(`전송 기록 실패 tx=${short(txHash)} — 훑기가 따라잡습니다`, error);
  }
}

/** DB 쓰기는 실패해도 프로세스를 죽이지 않습니다. 훑기가 다음 번에 따라잡습니다. */
async function write(
  outcomes: IssueOutcome[],
  txHash: string | null,
): Promise<void> {
  try {
    const changed = await markIssueResults(outcomes, txHash);
    logger.info(`발행 결과 기록 ${changed}/${outcomes.length}건`);
  } catch (error) {
    logger.error('발행 결과 기록 실패 — 훑기가 다시 시도합니다', error);
  }
}

function expected(cards: SentPhotocard[]): ExpectedIssue[] {
  return cards.map((card) => ({
    photocardKey: card.photocardKey,
    keyHash: hashOf(card.photocardKey),
    tokenId: card.tokenId,
    to: card.to,
  }));
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
          logger.warn(`추적 포기 tx=${short(txHash)} — 훑기로 넘깁니다`);
          watching.delete(txHash);
          watchingCount.set({ kind: 'photocard' }, watching.size);
        }
        continue;
      }

      watching.delete(txHash);
      watchingCount.set({ kind: 'photocard' }, watching.size);

      /* 성공이면 배치 안의 카드가 전부 나갔거나(발행) 이미 있었습니다(건너뜀).
         어느 쪽이든 그 키는 체인에서 소비됐으므로 MINTED 입니다. */
      if (!chain.success) {
        logger.error(
          `발행 실패 ${item.cards.length}건 tx=${short(txHash)} — ` +
            `${chain.revertReason ?? '사유 불명'}`,
        );
      }
      // 성공 영수증도 카드별 이벤트가 다를 수 있다. 각 요청의 증거를 따로 판정한다.
      confirmDuration.observe(
        { kind: 'photocard', result: chain.success ? 'minted' : 'failed' },
        (Date.now() - item.since) / 1000,
      );

      const outcomes = chain.success
        ? await classifyIssueReceipt(expected(item.cards), await getPhotocardIssueEvents(txHash), findPhotocardIssuance)
        : item.cards.map((card) => ({
            photocardKey: card.photocardKey,
            tokenId: card.tokenId,
            status: 'FAILED' as const,
            failureCode: 'TX_REVERTED',
            txHash,
          }));
      await write(outcomes, txHash);
    }
  } finally {
    ticking = false;
  }
}

/**
 * ② `MINTING` 인 행을 체인에 직접 물어봅니다.
 *
 * 재시작으로 추적 목록을 잃었거나, 트랜잭션이 드롭됐거나, DB 쓰기가 실패했던 건들이
 * 전부 여기로 걷힙니다. **이 서비스의 안전망입니다.**
 */
async function sweep(): Promise<void> {
  if (sweeping) return;
  sweeping = true;

  try {
    const rows = await findMinting(SWEEP_AFTER_SECONDS, SWEEP_LIMIT);
    if (rows.length === 0) return;

    logger.info(`훑기 — MINTING ${rows.length}건`);

    const outcomes: IssueOutcome[] = [];

    for (const row of rows) {
      // 추적 중이면 ①이 처리합니다.
      if (row.mintTxHash !== null && watching.has(row.mintTxHash)) continue;

      const expectedRow: ExpectedIssue = {
        photocardKey: row.photocardKey,
        keyHash: hashOf(row.photocardKey),
        tokenId: row.tokenId,
        to: row.to,
      };
      const historical = await findPhotocardIssuance(row.photocardKey);
      if (historical !== null) {
        sweepProcessed.inc({ kind: 'photocard' });
        outcomes.push(await verifyHistoricalIssue(expectedRow, async () => historical));
        continue;
      }

      /* 체인에 없습니다. 트랜잭션이 아직 대기 중일 수도 있어서, 영수증까지 없고
         충분히 오래된 것만 실패로 내립니다. 성급하게 FAILED 로 만들면 곧 실릴
         트랜잭션을 죽은 것으로 처리하게 됩니다. */
      if (row.mintTxHash === null) continue;

      const chain = await getTxStatus(row.mintTxHash);
      if (chain.found && !chain.mined) continue; // 아직 살아 있습니다
      if (chain.mined) {
        outcomes.push({
          photocardKey: row.photocardKey,
          tokenId: row.tokenId,
          status: 'FAILED',
          failureCode: chain.success ? 'MISSING_ISSUE_EVENT' : 'TX_REVERTED',
          txHash: row.mintTxHash,
        });
        continue;
      }

      logger.error(`트랜잭션 드롭 card=${row.photocardKey} tx=${short(row.mintTxHash)}`);
      // 🔴 0 이어야 정상인 값. 카드가 유실된 것이라 1건도 알림 대상이다
      txDropped.inc({ kind: 'photocard' });
      outcomes.push({
        photocardKey: row.photocardKey,
        tokenId: row.tokenId,
        status: 'FAILED',
        failureCode: 'TX_DROPPED',
        txHash: row.mintTxHash,
      });
    }

    if (outcomes.length > 0) await write(outcomes, null);
  } catch (error) {
    logger.error('포카 훑기 실패 — 다음 주기에 다시 시도합니다', error);
  } finally {
    sweeping = false;
  }
}

/**
 * 감시를 시작합니다. `main.ts` 가 기동할 때 한 번 부릅니다.
 *
 * 기동 시 **스키마를 먼저 확인**합니다. 컬럼이 없으면 그 자리에서 알립니다 —
 * 없으면 공연 하나치 발행이 조용히 깨지고, 그때는 이미 카드가 체인에 나간 뒤입니다.
 */
export async function startPhotocardConfirmWatcher(): Promise<string[]> {
  if (!dbEnabled()) {
    logger.warn('DATABASE_URL 이 없습니다 — 포카 확정 기록이 꺼진 채로 돕니다');
    return [];
  }

  const missing = await missingColumns();
  if (missing.length > 0) {
    logger.error(`nft_photocards 스키마가 기대와 다릅니다 — 없는 컬럼: ${missing.join(', ')}`);
    return missing;
  }

  tickTimer = setInterval(() => void tick(), TICK_MS);
  sweepTimer = setInterval(() => void sweep(), SWEEP_MS);

  await sweep();

  logger.info(`포카 확정 감시 시작 — 영수증 ${TICK_MS / 1000}초 · 훑기 ${SWEEP_MS / 1000}초`);
  return [];
}

export function stopPhotocardConfirmWatcher(): void {
  if (tickTimer) clearInterval(tickTimer);
  if (sweepTimer) clearInterval(sweepTimer);
  tickTimer = null;
  sweepTimer = null;
  watching.clear();
}
