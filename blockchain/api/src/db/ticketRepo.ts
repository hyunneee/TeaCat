import { db, dbEnabled } from './pool';
import { logger } from '../shared/logger';

/**
 * Spring 의 `tickets` 테이블에서 **확정 결과 컬럼만** 갱신합니다. (DESIGN.md 1장 예외)
 *
 * SQL 이 사는 유일한 곳입니다. 서비스는 여기를 통해서만 DB 에 닿습니다.
 *
 * ── 컬럼 소유권 ───────────────────────────────────────────────────
 *   우리가 쓰는 것 : transfer_status · token_id · mint_tx_hash · burn_tx_hash
 *   Spring 이 쓰는 것: 나머지 전부
 *
 * Spring 쪽에서는 이 컬럼들을 엔티티에 `updatable = false` 로 둬야 합니다.
 * 안 그러면 로드해 둔 엔티티가 flush 되면서 우리 UPDATE 를 덮어씁니다.
 */

/* ── 스키마 이름 ────────────────────────────────────────────────────
   **백엔드 팀과 확정되면 여기만 고칩니다.** 아직 서버 코드에 tickets 테이블이
   없어서, 기존 `wallet_seed_grants` 의 관례(스네이크·복수형·네이티브 ENUM)를
   따라 잡아두었습니다. 틀리면 기동 시 스키마 확인이 잡아냅니다. */
const TABLE = 'tickets';
const STATUS_ENUM = 'ticket_transfer_status';

const COLUMNS = {
  id: 'id',
  status: 'transfer_status',
  tokenId: 'token_id',
  mintTxHash: 'mint_tx_hash',
  burnTxHash: 'burn_tx_hash',
  updatedAt: 'updated_at',
  createdAt: 'created_at',
} as const;

/** DB 의 `ticket_transfer_status` ENUM 과 1:1 이어야 합니다. */
export type TransferStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface PendingTicket {
  /** `tickets.id`. 이 값이 곧 `ticketKey` 입니다 */
  ticketKey: string;
  mintTxHash: string | null;
}

/**
 * `ticketKey` 는 `tickets.id` 입니다. 기존 엔티티들이 전부 `Long id` 라 숫자로 봅니다.
 *
 * 숫자가 아니면 행을 찾을 수 없으므로 조용히 넘어가지 않고 알립니다 — PK 가 UUID 로
 * 바뀌었는데 아무도 모르는 상황이 제일 나쁩니다.
 */
function asRowId(ticketKey: string): string | null {
  return /^[0-9]{1,19}$/.test(ticketKey) ? ticketKey : null;
}

/**
 * **전송 직후** tokenId 와 txHash 를 남깁니다. 상태는 `PENDING` 그대로입니다.
 *
 * 확정될 때 한꺼번에 쓰면 될 것 같지만, 그러면 대기 중인 행에 txHash 가 없습니다.
 * 두 가지가 망가집니다.
 *
 *   1. 훑기가 드롭을 판정하지 못합니다 — 볼 트랜잭션이 없으니 영원히 PENDING
 *   2. 우리가 재시작해 훑기로 복구된 행에는 어느 tx 로 발행됐는지가 안 남습니다
 *
 * 실제로 로컬에서 2번을 밟고 나서 추가한 함수입니다.
 */
export async function markIssueSent(
  ticketKey: string,
  tokenId: string,
  mintTxHash: string,
): Promise<boolean> {
  if (!dbEnabled()) return false;

  const rowId = asRowId(ticketKey);
  if (rowId === null) {
    logger.error(`전송 기록 실패 — ticketKey 가 tickets.id 형식이 아닙니다 (${ticketKey.length}자)`);
    return false;
  }

  const sql = `
    UPDATE ${TABLE}
       SET ${COLUMNS.tokenId} = $1,
           ${COLUMNS.mintTxHash} = $2,
           ${COLUMNS.updatedAt} = now()
     WHERE ${COLUMNS.id} = $3::bigint
       AND ${COLUMNS.status} = 'PENDING'::${STATUS_ENUM}`;

  const result = await db().query(sql, [tokenId, mintTxHash, rowId]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * 발행 확정을 기록합니다.
 *
 * **조건부 UPDATE 입니다.** `PENDING` 인 행만 바꿉니다 — 무조건 덮으면 그 사이
 * 취소된 행을 되살립니다. 이미 옮겨간 행은 건드리지 않고 0건으로 끝납니다.
 *
 * `updated_at` 을 직접 넣습니다. Hibernate 의 `@UpdateTimestamp` 를 우회하므로
 * 우리가 안 쓰면 그 컬럼이 발행 시점에 멈춰 있습니다.
 */
export async function markIssueResult(
  ticketKey: string,
  status: Exclude<TransferStatus, 'PENDING'>,
  tokenId: string,
  mintTxHash: string | null,
): Promise<boolean> {
  if (!dbEnabled()) return false;

  const rowId = asRowId(ticketKey);
  if (rowId === null) {
    logger.error(`확정 기록 실패 — ticketKey 가 tickets.id 형식이 아닙니다 (${ticketKey.length}자)`);
    return false;
  }

  const sql = `
    UPDATE ${TABLE}
       SET ${COLUMNS.status} = $1::${STATUS_ENUM},
           ${COLUMNS.tokenId} = $2,
           ${COLUMNS.mintTxHash} = COALESCE($3, ${COLUMNS.mintTxHash}),
           ${COLUMNS.updatedAt} = now()
     WHERE ${COLUMNS.id} = $4::bigint
       AND ${COLUMNS.status} = 'PENDING'::${STATUS_ENUM}`;

  const result = await db().query(sql, [status, tokenId, mintTxHash, rowId]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * 소각(예매 취소) 확정을 기록합니다.
 *
 * 취소는 Spring 이 직접 트리거하므로 상태 전이는 Spring 이 소유합니다.
 * 우리는 `burn_tx_hash` 만 채웁니다 — 어느 트랜잭션으로 태웠는지의 근거입니다.
 */
export async function markBurnTx(ticketKey: string, burnTxHash: string): Promise<boolean> {
  if (!dbEnabled()) return false;

  const rowId = asRowId(ticketKey);
  if (rowId === null) return false;

  const sql = `
    UPDATE ${TABLE}
       SET ${COLUMNS.burnTxHash} = $1,
           ${COLUMNS.updatedAt} = now()
     WHERE ${COLUMNS.id} = $2::bigint`;

  const result = await db().query(sql, [burnTxHash, rowId]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * 아직 `PENDING` 인 티켓들. **훑기(sweep)가 씁니다.**
 *
 * 우리가 재시작하면 추적 중이던 트랜잭션 목록이 통째로 사라집니다. 그때 남는 유일한
 * 단서가 이 행들입니다 — 여기서 `ticketKey` 를 꺼내 체인에 직접 물어봅니다.
 * 드롭된 트랜잭션도 같은 경로로 걷힙니다.
 *
 * 방금 보낸 건은 아직 블록에 안 실렸으니 `olderThanSeconds` 로 걸러냅니다.
 */
export async function findPending(
  olderThanSeconds: number,
  limit: number,
): Promise<PendingTicket[]> {
  if (!dbEnabled()) return [];

  const sql = `
    SELECT ${COLUMNS.id}::text AS ticket_key, ${COLUMNS.mintTxHash} AS mint_tx_hash
      FROM ${TABLE}
     WHERE ${COLUMNS.status} = 'PENDING'::${STATUS_ENUM}
       AND ${COLUMNS.createdAt} < now() - make_interval(secs => $1)
     ORDER BY ${COLUMNS.createdAt}
     LIMIT $2`;

  const result = await db().query<{ ticket_key: string; mint_tx_hash: string | null }>(sql, [
    olderThanSeconds,
    limit,
  ]);

  return result.rows.map((row) => ({ ticketKey: row.ticket_key, mintTxHash: row.mint_tx_hash }));
}

/**
 * 기동할 때 스키마가 기대대로인지 확인합니다.
 *
 * ORM 을 안 쓰는 대신 두는 장치입니다. Spring 이 컬럼 이름을 바꾸거나 마이그레이션을
 * 돌리면 우리는 컴파일로 못 잡습니다 — 이게 없으면 **첫 티켓 발행 때** 조용히 깨지고,
 * 그때는 이미 유저가 결제를 끝낸 뒤입니다. 부팅에서 죽는 편이 훨씬 낫습니다.
 *
 * 없는 것만 돌려줍니다. 비어 있으면 정상입니다.
 */
export async function missingColumns(): Promise<string[]> {
  if (!dbEnabled()) return [];

  const expected = Object.values(COLUMNS);
  const sql = `
    SELECT column_name
      FROM information_schema.columns
     WHERE table_name = $1 AND column_name = ANY($2::text[])`;

  const result = await db().query<{ column_name: string }>(sql, [TABLE, expected]);
  const found = new Set(result.rows.map((row) => row.column_name));

  return expected.filter((column) => !found.has(column)).map((column) => `${TABLE}.${column}`);
}
