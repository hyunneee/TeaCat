import { Pool } from 'pg';
import { env } from '../config';
import { logger } from '../shared/logger';

/**
 * Spring DB 커넥션. (DESIGN.md 1장 "예외 하나")
 *
 * **우리 DB 가 아닙니다.** 스키마의 주인은 Spring/Hibernate 이고, 우리는 확정 결과를
 * 받아 적는 컬럼 몇 개만 갱신합니다. 테이블을 만들지도, 마이그레이션하지도 않습니다.
 *
 * ── 규칙 ──────────────────────────────────────────────────────────
 * **SQL 은 `db/` 안에서만 씁니다.** `chain/` 밖에서 `ethers` 를 import 하지 않는
 * 것(4-1)과 같은 이유입니다 — 서비스는 "확정을 기록한다" 만 알고, 그게 UPDATE 라는
 * 건 몰라야 나중에 전달 방식을 콜백이나 큐로 바꿀 때 서비스를 안 건드립니다.
 *
 * ── 없어도 서버는 뜹니다 ──────────────────────────────────────────
 * `DATABASE_URL` 이 없으면 커넥션을 만들지 않고 확정 기록만 꺼집니다.
 * 체인만 있으면 개발할 수 있게 하기 위해서입니다. 다만 운영에서 빠뜨리면 티켓이
 * 영원히 PENDING 으로 남으므로 `/health` 가 경고합니다.
 */

let pool: Pool | null = null;

if (env.DATABASE_URL) {
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    // 확정 기록은 초당 몇 건이라 커넥션이 많이 필요 없습니다.
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  /* 풀이 던지는 에러를 잡지 않으면 프로세스가 통째로 죽습니다.
     DB 가 잠깐 끊긴다고 오퍼레이터 키를 쥔 프로세스를 내릴 이유는 없습니다 —
     확정 기록은 훑기(sweep)가 나중에 따라잡습니다. */
  pool.on('error', (error) => {
    logger.error('DB 풀 오류 (프로세스는 계속 돕니다)', error);
  });
}

/** 확정 기록이 켜져 있는지. 꺼져 있으면 서비스가 조용히 넘어갑니다. */
export function dbEnabled(): boolean {
  return pool !== null;
}

/** `db/` 안에서만 씁니다. */
export function db(): Pool {
  if (pool === null) {
    throw new Error('DATABASE_URL 이 없습니다. dbEnabled() 로 먼저 확인하세요');
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool === null) return;
  await pool.end();
  pool = null;
}

/** `/health` 용. 연결이 살아 있는지만 봅니다. */
export async function pingDb(): Promise<boolean> {
  if (pool === null) return false;
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
