import {
  drawIdOf,
  drawSeedConfigured,
  getDraw,
  isRevealable,
  pendingDrawIds,
  revealDrawById,
  verifiableDrawAddress,
} from '../chain/contracts/verifiableDraw';
import { logger, short } from '../shared/logger';

/**
 * 자동 리빌 — 커밋한 추첨을 때가 되면 우리가 공개합니다. (PHOTOCARD_PLAN.md 4-8)
 *
 * ── 왜 자동이어야 하나 ────────────────────────────────────────────
 * `blockhash` 는 최근 **256블록**만 남습니다. 이 체인은 블록이 약 10초라 **42분**이고,
 * 그 안에 공개하지 못하면 **그 추첨은 되살릴 수 없습니다.** 사람이나 다른 서비스가
 * 부르는 구조로 두면 그 시한을 놓친 추첨이 죽습니다.
 *
 * ── 두 갈래를 같이 돌립니다 (확정 감시와 같은 구조) ──────────────
 *
 *   ① 추적   방금 연 추첨을 메모리에 들고 대상 블록이 생기면 바로 공개합니다
 *   ② 훑기   체인의 `DrawOpened` 로그를 훑어 놓친 것을 걷어냅니다
 *
 * **①만 두면 안 됩니다.** 재시작하면 추적 목록이 통째로 사라지고, 그 추첨들은
 * 42분 뒤 조용히 죽습니다.
 *
 * ── ②가 DB 없이 되는 이유 ────────────────────────────────────────
 * **블록해시 창이 곧 우리가 봐야 할 범위입니다.** 256블록보다 오래된 추첨은 어차피
 * 되살릴 수 없으므로 찾을 이유가 없습니다. 그래서 최근 256블록의 로그만 보면
 * 복구할 것이 전부 나옵니다 — 티켓과 달리 DB 가 필요 없습니다.
 *
 * 시드가 `drawKey` 원문이 아니라 **해시된 `drawId` 에서** 파생되는 것이 여기서
 * 값을 합니다. 로그에는 `drawId` 만 있는데 그것만으로 공개할 수 있습니다.
 */

/** 대상 블록이 생겼는지 확인하는 주기. 블록이 10초라 이보다 촘촘할 이유가 없습니다. */
const TICK_MS = 3_000;
/** 훑기 주기. 재시작 복구용이라 자주 돌 필요가 없습니다. */
const SWEEP_MS = 60_000;
/**
 * 추적을 포기하는 시각. 이만큼 지나면 ②가 맡습니다.
 *
 * 창(42분)보다 넉넉히 짧게 잡습니다 — ①에서 놓쳐도 ②가 걷어낼 시간이 남아야 합니다.
 */
const TRACK_TIMEOUT_MS = 10 * 60_000;

/** drawKey → 언제부터 기다리는 중인지. 재시작하면 사라집니다 (그래서 훑기가 있습니다). */
const watching = new Map<string, number>();

let tickTimer: NodeJS.Timeout | null = null;
let sweepTimer: NodeJS.Timeout | null = null;
let ticking = false;
let sweeping = false;

/** 방금 연 추첨을 추적 목록에 올립니다. `openDrawFor` 가 부릅니다. */
export function watchDraw(drawKey: string): void {
  watching.set(drawKey, Date.now());
}

/** ① 추적 중인 추첨의 대상 블록이 생겼으면 바로 공개합니다. */
async function tick(): Promise<void> {
  if (ticking || watching.size === 0) return;
  ticking = true;

  try {
    for (const [drawKey, since] of [...watching]) {
      try {
        const draw = await getDraw(drawKey);

        // 이미 끝났거나(감시 중복·수동 공개) 취소됐으면 놓습니다.
        if (!draw.exists || draw.revealed || draw.canceled) {
          watching.delete(drawKey);
          continue;
        }

        if (!(await isRevealable(draw))) {
          if (Date.now() - since > TRACK_TIMEOUT_MS) {
            logger.warn(`추첨 추적 포기 draw=${drawKey} — 훑기로 넘깁니다`);
            watching.delete(drawKey);
          }
          continue;
        }

        watching.delete(drawKey);
        const txHash = await revealDrawById(drawIdOf(drawKey));
        logger.info(`추첨 자동 공개 draw=${drawKey} tx=${short(txHash)}`);
      } catch (error) {
        /* 여기서 던지면 나머지 추첨이 같이 멈춥니다. 하나가 실패해도 계속 돌고,
           놓친 것은 훑기가 다시 봅니다. */
        logger.warn(`추첨 공개 실패 draw=${drawKey} — 훑기가 다시 시도합니다`, error);
      }
    }
  } finally {
    ticking = false;
  }
}

/**
 * ② 체인의 로그를 훑어 공개되지 않은 추첨을 걷어냅니다.
 *
 * **이 서비스의 안전망입니다.** 재시작으로 추적 목록을 잃었거나, 공개 트랜잭션이
 * 드롭됐거나, 다른 인스턴스가 열었던 건들이 전부 여기로 걷힙니다.
 */
async function sweep(): Promise<void> {
  if (sweeping) return;
  sweeping = true;

  try {
    const pending = await pendingDrawIds();
    if (pending.length === 0) return;

    logger.info(`추첨 훑기 — 공개 대기 ${pending.length}건`);

    for (const drawId of pending) {
      try {
        const txHash = await revealDrawById(drawId);
        logger.info(`추첨 공개(훑기) draw=${short(drawId)} tx=${short(txHash)}`);
      } catch (error) {
        logger.error(`추첨 공개 실패(훑기) draw=${short(drawId)}`, error);
      }
    }
  } catch (error) {
    logger.error('추첨 훑기 실패 — 다음 주기에 다시 시도합니다', error);
  } finally {
    sweeping = false;
  }
}

/**
 * 감시를 시작합니다. `main.ts` 가 기동할 때 한 번 부릅니다.
 *
 * 컨트랙트가 없거나 시드 비밀이 없으면 **경고하고 돌지 않습니다.** 조용히 넘기면
 * 추첨을 열 수는 있는데 아무도 공개하지 않는 상태가 되고, 42분 뒤에야 드러납니다.
 */
export function startDrawWatcher(): boolean {
  if (verifiableDrawAddress() === null) {
    logger.warn('VerifiableDraw 가 배포되지 않았습니다 — 자동 리빌이 꺼진 채로 돕니다');
    return false;
  }
  if (!drawSeedConfigured()) {
    logger.warn('DRAW_SEED_SECRET 이 없습니다 — 자동 리빌이 꺼진 채로 돕니다');
    return false;
  }

  tickTimer = setInterval(() => void tick(), TICK_MS);
  sweepTimer = setInterval(() => void sweep(), SWEEP_MS);

  // 기동 직후 한 번 훑습니다. 죽어 있는 동안 열린 추첨을 바로 걷어냅니다.
  void sweep();

  logger.info(`자동 리빌 시작 — 추적 ${TICK_MS / 1000}초 · 훑기 ${SWEEP_MS / 1000}초`);
  return true;
}

export function stopDrawWatcher(): void {
  if (tickTimer) clearInterval(tickTimer);
  if (sweepTimer) clearInterval(sweepTimer);
  tickTimer = null;
  sweepTimer = null;
  watching.clear();
}
