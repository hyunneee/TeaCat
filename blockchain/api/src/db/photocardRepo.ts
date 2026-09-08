import { db, dbEnabled } from './pool';
import { logger } from '../shared/logger';

/**
 * Spring 의 `nft_photocards` 에서 **확정 결과 컬럼만** 갱신합니다. (DESIGN.md 1장 예외)
 *
 * SQL 이 사는 유일한 곳입니다. 서비스는 여기를 통해서만 DB 에 닿습니다.
 *
 * ── 컬럼 소유권 ───────────────────────────────────────────────────
 *   우리가 쓰는 것 : status · token_id · chain_id · contract_address ·
 *                    mint_tx_hash · minted_at
 *   Spring 이 쓰는 것: 나머지 전부 (design_id · ticket_id · owner_id · wallet_id …)
 *
 * Spring 쪽에서는 이 컬럼들을 엔티티에 `updatable = false` 로 둬야 합니다.
 * 안 그러면 로드해 둔 `NftPhotocard` 가 flush 되면서 우리 UPDATE 를 덮어씁니다.
 *
 * ── 티켓과 다른 점 ────────────────────────────────────────────────
 * 티켓은 한 트랜잭션에 한 장이라 행도 하나였습니다. 포카는 **한 트랜잭션에 최대
 * 200행**이라 전부 묶어서 갱신합니다.
 */

const TABLE = 'nft_photocards';
const STATUS_ENUM = 'nft_mint_status';

const COLUMNS = {
  id: 'id',
  status: 'status',
  tokenId: 'token_id',
  chainId: 'chain_id',
  contractAddress: 'contract_address',
  mintTxHash: 'mint_tx_hash',
  mintedAt: 'minted_at',
  updatedAt: 'updated_at',
  createdAt: 'created_at',
} as const;

/** DB 의 `nft_mint_status` ENUM 과 1:1 이어야 합니다. */
export type MintStatus = 'PENDING' | 'MINTING' | 'MINTED' | 'FAILED';

export interface PendingPhotocard {
  /** `nft_photocards.id`. 이 값이 곧 `photocardKey` 입니다 */
  photocardKey: string;
  mintTxHash: string | null;
}

/** 전송 직후 기록할 값. 카드마다 도안이 달라 `tokenId` 가 행마다 다릅니다. */
export interface SentPhotocard {
  photocardKey: string;
  /** = designId. 포카의 tokenId 는 도안입니다 */
  tokenId: string;
}

/**
 * `photocardKey` 는 `nft_photocards.id` 입니다. 숫자가 아니면 행을 찾을 수 없으므로
 * 조용히 넘어가지 않고 알립니다 — PK 가 바뀌었는데 아무도 모르는 상황이 제일 나쁩니다.
 */
function asRowId(photocardKey: string): string | null {
  return /^[0-9]{1,19}$/.test(photocardKey) ? photocardKey : null;
}

function partition(keys: SentPhotocard[]): { ids: string[]; tokenIds: string[] } {
  const ids: string[] = [];
  const tokenIds: string[] = [];

  for (const item of keys) {
    const rowId = asRowId(item.photocardKey);
    if (rowId === null) {
      logger.error(`전송 기록 건너뜀 — photocardKey 가 id 형식이 아닙니다 (${item.photocardKey})`);
      continue;
    }
    ids.push(rowId);
    tokenIds.push(item.tokenId);
  }
  return { ids, tokenIds };
}

/**
 * **전송 직후** `MINTING` 으로 올리고 체인 정보를 남깁니다.
 *
 * 확정될 때 한꺼번에 쓰면 될 것 같지만, 그러면 대기 중인 행에 txHash 가 없습니다.
 * 두 가지가 망가집니다.
 *
 *   1. 훑기가 드롭을 판정하지 못합니다 — 볼 트랜잭션이 없으니 영원히 PENDING
 *   2. 재시작해 훑기로 복구된 행에 어느 tx 로 발행됐는지가 안 남습니다
 *
 * 티켓에서 실제로 밟고 나서 고친 자리라, 포카는 처음부터 이렇게 둡니다.
 *
 * `PENDING` 인 행만 바꿉니다. 이미 옮겨간 행은 건드리지 않고 0건으로 끝납니다.
 */
export async function markIssueSent(
  cards: SentPhotocard[],
  chainId: number,
  contractAddress: string,
  mintTxHash: string,
): Promise<number> {
  if (!dbEnabled() || cards.length === 0) return 0;

  const { ids, tokenIds } = partition(cards);
  if (ids.length === 0) return 0;

  /* `unnest` 로 행마다 다른 tokenId 를 한 번에 넣습니다. 200번 UPDATE 를 보내면
     그만큼 왕복이 생기고, 그 사이에 프로세스가 죽으면 절반만 기록됩니다. */
  const sql = `
    UPDATE ${TABLE} AS p
       SET ${COLUMNS.status} = 'MINTING'::${STATUS_ENUM},
           ${COLUMNS.tokenId} = v.token_id::numeric,
           ${COLUMNS.chainId} = $3::int,
           ${COLUMNS.contractAddress} = $4,
           ${COLUMNS.mintTxHash} = $5,
           ${COLUMNS.updatedAt} = now()
      FROM unnest($1::bigint[], $2::text[]) AS v(id, token_id)
     WHERE p.${COLUMNS.id} = v.id
       AND p.${COLUMNS.status} = 'PENDING'::${STATUS_ENUM}`;

  const result = await db().query(sql, [
    ids,
    tokenIds,
    chainId,
    contractAddress.toLowerCase(),
    mintTxHash,
  ]);
  return result.rowCount ?? 0;
}

/**
 * 확정을 기록합니다.
 *
 * **조건부 UPDATE 입니다.** `MINTING` 인 행만 바꿉니다 — 무조건 덮으면 그 사이
 * Spring 이 옮긴 행을 되살립니다.
 *
 * `updated_at` 을 직접 넣습니다. Hibernate 의 `@UpdateTimestamp` 를 우회하므로
 * 우리가 안 쓰면 그 컬럼이 발행 시점에 멈춰 있습니다.
 */
export async function markIssueResult(
  photocardKeys: string[],
  status: 'MINTED' | 'FAILED',
  mintTxHash: string | null,
): Promise<number> {
  if (!dbEnabled() || photocardKeys.length === 0) return 0;

  const ids = photocardKeys.map(asRowId).filter((id): id is string => id !== null);
  if (ids.length === 0) return 0;

  const sql = `
    UPDATE ${TABLE}
       SET ${COLUMNS.status} = $2::${STATUS_ENUM},
           ${COLUMNS.mintedAt} = CASE WHEN $2 = 'MINTED' THEN now() ELSE ${COLUMNS.mintedAt} END,
           ${COLUMNS.mintTxHash} = COALESCE($3, ${COLUMNS.mintTxHash}),
           ${COLUMNS.updatedAt} = now()
     WHERE ${COLUMNS.id} = ANY($1::bigint[])
       AND ${COLUMNS.status} = 'MINTING'::${STATUS_ENUM}`;

  const result = await db().query(sql, [ids, status, mintTxHash]);
  return result.rowCount ?? 0;
}

/**
 * 아직 `MINTING` 인 카드들. **훑기(sweep)가 씁니다.**
 *
 * 재시작하면 추적 중이던 트랜잭션 목록이 통째로 사라집니다. 그때 남는 유일한 단서가
 * 이 행들입니다 — 여기서 `photocardKey` 를 꺼내 체인에 직접 물어봅니다.
 *
 * `PENDING` 은 보지 않습니다. 그건 Spring 이 행만 만들고 아직 우리에게 발행을
 * 요청하지 않은 상태라, 우리가 손댈 것이 아닙니다.
 */
export async function findMinting(
  olderThanSeconds: number,
  limit: number,
): Promise<PendingPhotocard[]> {
  if (!dbEnabled()) return [];

  const sql = `
    SELECT ${COLUMNS.id}::text AS photocard_key, ${COLUMNS.mintTxHash} AS mint_tx_hash
      FROM ${TABLE}
     WHERE ${COLUMNS.status} = 'MINTING'::${STATUS_ENUM}
       AND ${COLUMNS.updatedAt} < now() - make_interval(secs => $1)
     ORDER BY ${COLUMNS.updatedAt}
     LIMIT $2`;

  const result = await db().query<{ photocard_key: string; mint_tx_hash: string | null }>(sql, [
    olderThanSeconds,
    limit,
  ]);

  return result.rows.map((row) => ({
    photocardKey: row.photocard_key,
    mintTxHash: row.mint_tx_hash,
  }));
}

/**
 * 기동할 때 스키마가 기대대로인지 확인합니다.
 *
 * ORM 을 안 쓰는 대신 두는 장치입니다. 이게 없으면 **공연 하나치 발행이** 조용히
 * 깨지고, 그때는 이미 카드가 체인에 나간 뒤입니다. 부팅에서 죽는 편이 낫습니다.
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
