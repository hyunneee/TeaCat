import { db, dbEnabled } from './pool';
import { logger } from '../shared/logger';

/**
 * Spring 의 `nft_tickets` 에서 **확정 결과 컬럼만** 갱신합니다. (DESIGN.md 1장 예외)
 *
 * SQL 이 사는 유일한 곳입니다. 서비스는 여기를 통해서만 DB 에 닿습니다.
 *
 * ── `tickets` 가 아니라 `nft_tickets` 입니다 ──────────────────────
 *
 * 2026-09-08 에 바로잡았습니다. 그전에는 `tickets` 의 `transfer_status`·`token_id` 를
 * 갱신하도록 짜여 있었는데 **그 컬럼도, `ticket_transfer_status` ENUM 도 존재하지
 * 않았습니다.** 스키마를 추측으로 잡아둔 것이 틀렸던 것이고, `DATABASE_URL` 을 붙이면
 * 기동 시 스키마 확인에서 죽었습니다.
 *
 * 실제 체인 정보는 `nft_tickets` 에 있고, 모양이 `nft_photocards` 와 같습니다 —
 * 두 확정 감시가 같은 구조인 이유입니다.
 *
 * ── 행을 찾는 열쇠는 `ticket_key` 입니다 ─────────────────────────
 *
 * Spring 이 발행 요청에 싣는 UUID 이고, **서버가 그대로 keccak256 해서 온체인
 * `tokenId` 를 만듭니다.** 그래서 이 값으로 찾지 않으면 체인과 DB 를 이을 수 없습니다.
 *
 * 예전처럼 `tickets.id`(순번)를 쓰면 두 가지가 깨집니다.
 *   1. 훑기가 `hashOf(순번)` 으로 체인에 물어보는데 체인엔 `hashOf(uuid)` 가 있어
 *      "발행 안 됨" 으로 읽고 **성공한 발행을 FAILED 로 내립니다**
 *   2. 개발 중 DB 를 밀면 같은 번호가 재사용되는데 공용 체인은 못 밀어서
 *      그 키가 `AlreadyIssued` 로 영구히 막힙니다
 *
 * ── 컬럼 소유권 ───────────────────────────────────────────────────
 *   우리가 쓰는 것 : status · token_id · chain_id · contract_address ·
 *                    mint_tx_hash · burn_tx_hash · minted_at
 *   Spring 이 쓰는 것: 나머지 전부 (ticket_id · wallet_id · ticket_key)
 *
 * Spring 엔티티에서 우리 컬럼들을 `updatable = false` 로 둬야 합니다.
 * 안 그러면 로드해 둔 엔티티가 flush 되면서 우리 UPDATE 를 덮어씁니다.
 *
 * ── 백엔드에 필요한 마이그레이션 ─────────────────────────────────
 * ```sql
 * ALTER TABLE nft_tickets
 *     ADD COLUMN ticket_key   uuid NOT NULL,
 *     ADD COLUMN burn_tx_hash char(66),
 *     ADD CONSTRAINT uq_nft_tickets_ticket_key UNIQUE (ticket_key);
 * ```
 * 행이 이미 있으면 `NOT NULL` 을 나중에 걸어야 하는데, **아무 값이나 채우면 안
 * 됩니다** — 체인에 올라간 키와 달라지면 그 행은 영영 못 잇습니다.
 */

const TABLE = 'nft_tickets';
const STATUS_ENUM = 'nft_mint_status';

const COLUMNS = {
  ticketKey: 'ticket_key',
  status: 'status',
  tokenId: 'token_id',
  chainId: 'chain_id',
  contractAddress: 'contract_address',
  mintTxHash: 'mint_tx_hash',
  burnTxHash: 'burn_tx_hash',
  mintedAt: 'minted_at',
  updatedAt: 'updated_at',
} as const;

/** DB 의 `nft_mint_status` ENUM 과 1:1 이어야 합니다. */
export type MintStatus = 'PENDING' | 'MINTING' | 'MINTED' | 'FAILED';

export interface PendingTicket {
  /** `nft_tickets.ticket_key`. 이 값이 곧 `ticketKey` 이고, 해싱하면 tokenId 입니다 */
  ticketKey: string;
  mintTxHash: string | null;
}

/**
 * UUID 모양인지만 봅니다.
 *
 * `::uuid` 캐스팅은 모양이 틀리면 **Postgres 가 예외를 던집니다.** 그러면 확정 기록
 * 한 건이 아니라 그 주기의 훑기가 통째로 죽습니다. 여기서 걸러 로그만 남깁니다.
 */
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function asKey(ticketKey: string): string | null {
  return UUID.test(ticketKey) ? ticketKey : null;
}

/**
 * **전송 직후** `MINTING` 으로 올리고 체인 정보를 남깁니다.
 *
 * 확정될 때 한꺼번에 쓰면 될 것 같지만, 그러면 대기 중인 행에 txHash 가 없습니다.
 * 두 가지가 망가집니다.
 *
 *   1. 훑기가 드롭을 판정하지 못합니다 — 볼 트랜잭션이 없으니 영원히 대기
 *   2. 재시작해 훑기로 복구된 행에 어느 tx 로 발행됐는지가 안 남습니다
 *
 * 실제로 로컬에서 2번을 밟고 나서 추가한 함수입니다.
 *
 * `PENDING` 인 행만 바꿉니다. 이미 옮겨간 행은 건드리지 않고 0건으로 끝납니다.
 */
export async function markIssueSent(
  ticketKey: string,
  tokenId: string,
  chainId: number,
  contractAddress: string,
  mintTxHash: string,
): Promise<boolean> {
  if (!dbEnabled()) return false;

  const key = asKey(ticketKey);
  if (key === null) {
    logger.error(`전송 기록 실패 — ticketKey 가 UUID 형식이 아닙니다 (${ticketKey.length}자)`);
    return false;
  }

  const sql = `
    UPDATE ${TABLE}
       SET ${COLUMNS.status} = 'MINTING'::${STATUS_ENUM},
           ${COLUMNS.tokenId} = $2::numeric,
           ${COLUMNS.chainId} = $3::int,
           ${COLUMNS.contractAddress} = $4,
           ${COLUMNS.mintTxHash} = $5,
           ${COLUMNS.updatedAt} = now()
     WHERE ${COLUMNS.ticketKey} = $1::uuid
       AND ${COLUMNS.status} = 'PENDING'::${STATUS_ENUM}`;

  const result = await db().query(sql, [
    key,
    tokenId,
    chainId,
    contractAddress.toLowerCase(),
    mintTxHash,
  ]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * 발행 확정을 기록합니다.
 *
 * **`PENDING` 과 `MINTING` 을 둘 다 받습니다.** `ALREADY_ISSUED` 경로는 새 트랜잭션이
 * 없어 `MINTING` 을 거치지 않고 바로 여기로 오기 때문입니다.
 *
 * `updated_at` 을 직접 넣습니다. Hibernate 의 `@UpdateTimestamp` 를 우회하므로
 * 우리가 안 쓰면 그 컬럼이 발행 시점에 멈춰 있습니다.
 */
export async function markIssueResult(
  ticketKey: string,
  status: 'MINTED' | 'FAILED',
  tokenId: string,
  chainId: number,
  contractAddress: string,
  mintTxHash: string | null,
): Promise<boolean> {
  if (!dbEnabled()) return false;

  const key = asKey(ticketKey);
  if (key === null) {
    logger.error(`확정 기록 실패 — ticketKey 가 UUID 형식이 아닙니다 (${ticketKey.length}자)`);
    return false;
  }

  const sql = `
    UPDATE ${TABLE}
       SET ${COLUMNS.status} = $2::${STATUS_ENUM},
           ${COLUMNS.tokenId} = $3::numeric,
           ${COLUMNS.chainId} = $4::int,
           ${COLUMNS.contractAddress} = $5,
           ${COLUMNS.mintTxHash} = COALESCE($6, ${COLUMNS.mintTxHash}),
           ${COLUMNS.mintedAt} = CASE WHEN $2 = 'MINTED' THEN now() ELSE ${COLUMNS.mintedAt} END,
           ${COLUMNS.updatedAt} = now()
     WHERE ${COLUMNS.ticketKey} = $1::uuid
       AND ${COLUMNS.status} IN ('PENDING'::${STATUS_ENUM}, 'MINTING'::${STATUS_ENUM})`;

  const result = await db().query(sql, [
    key,
    status,
    tokenId,
    chainId,
    contractAddress.toLowerCase(),
    mintTxHash,
  ]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * 소각(예매 취소) 트랜잭션을 기록합니다.
 *
 * **여기만 `ticket_key` 가 아니라 `token_id` 로 찾습니다.** 소각 요청은 경로가
 * `/tickets/{tokenId}/burn` 이라 우리가 아는 건 번호뿐이고, `tokenId` 는
 * `keccak256(ticketKey)` 라 **역산이 안 됩니다.**
 *
 * `(chain_id, contract_address, token_id)` 로 좁힙니다 — 컨트랙트를 재배포하면
 * 같은 번호가 다른 컨트랙트에 또 생길 수 있습니다.
 *
 * **상태는 건드리지 않습니다.** 취소는 Spring 이 트리거하므로 상태 전이는 Spring 이
 * 소유합니다 (`tickets.status = CANCELLED`). 우리는 "어느 트랜잭션으로 태웠는지" 의
 * 근거만 남깁니다.
 */
export async function markBurnTx(
  tokenId: string,
  chainId: number,
  contractAddress: string,
  burnTxHash: string,
): Promise<boolean> {
  if (!dbEnabled()) return false;

  const sql = `
    UPDATE ${TABLE}
       SET ${COLUMNS.burnTxHash} = $4,
           ${COLUMNS.updatedAt} = now()
     WHERE ${COLUMNS.tokenId} = $1::numeric
       AND ${COLUMNS.chainId} = $2::int
       AND ${COLUMNS.contractAddress} = $3`;

  const result = await db().query(sql, [
    tokenId,
    chainId,
    contractAddress.toLowerCase(),
    burnTxHash,
  ]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * 아직 `MINTING` 인 티켓들. **훑기(sweep)가 씁니다.**
 *
 * 재시작하면 추적 중이던 트랜잭션 목록이 통째로 사라집니다. 그때 남는 유일한 단서가
 * 이 행들입니다 — 여기서 `ticket_key` 를 꺼내 해싱해 체인에 직접 물어봅니다.
 *
 * `PENDING` 은 보지 않습니다. 그건 Spring 이 행만 만들고 아직 발행을 요청하지 않은
 * 상태라 우리가 손댈 것이 아닙니다.
 */
export async function findMinting(
  olderThanSeconds: number,
  limit: number,
): Promise<PendingTicket[]> {
  if (!dbEnabled()) return [];

  const sql = `
    SELECT ${COLUMNS.ticketKey}::text AS ticket_key, ${COLUMNS.mintTxHash} AS mint_tx_hash
      FROM ${TABLE}
     WHERE ${COLUMNS.status} = 'MINTING'::${STATUS_ENUM}
       AND ${COLUMNS.updatedAt} < now() - make_interval(secs => $1)
     ORDER BY ${COLUMNS.updatedAt}
     LIMIT $2`;

  const result = await db().query<{ ticket_key: string; mint_tx_hash: string | null }>(sql, [
    olderThanSeconds,
    limit,
  ]);

  return result.rows.map((row) => ({
    ticketKey: row.ticket_key,
    mintTxHash: row.mint_tx_hash,
  }));
}

/**
 * 기동할 때 스키마가 기대대로인지 확인합니다.
 *
 * ORM 을 안 쓰는 대신 두는 장치입니다. **이게 없었으면 `tickets` 를 보고 있던 것도
 * 첫 발행 때 알았을 겁니다** — 그때는 이미 유저가 결제를 끝낸 뒤입니다.
 * 실제로 이 검사가 그 오류를 잡아냈습니다.
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
