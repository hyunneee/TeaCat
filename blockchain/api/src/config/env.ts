import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { z } from 'zod';

/**
 * 환경변수 로딩.
 *
 * `.env` 는 blockchain/ 루트에 하나만 두고 contracts 와 함께 읽습니다.
 * 커밋되지 않으므로, 없으면 `npm run setup:env` 로 만듭니다.
 * 각 변수의 의미는 `.env.example` 에 있습니다 (값 없이 설명만 있는 파일).
 *
 * 운영에서는 컨테이너·오케스트레이터가 넣어준 실제 환경변수가 그대로 쓰입니다.
 */
const ROOT = path.resolve(__dirname, '../../../');

dotenv.config({ path: path.join(ROOT, '.env') });

const HEX_PRIVATE_KEY = /^0x[0-9a-fA-F]{64}$/;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  CHAIN_ID: z.coerce.number().int().positive(),
  RPC_URL: z.string().url(),

  // DESIGN.md 5-2 — 전송 방식을 이 한 줄로 갈아끼웁니다
  TX_SENDER: z.enum(['relayer', 'direct-4337', 'bundler']).default('relayer'),

  // 주의: 유저 자산의 마스터키. 이 프로세스 밖으로 나가면 안 됩니다.
  MASTER_MNEMONIC: z.string().min(1, 'MASTER_MNEMONIC 이 비어 있습니다'),
  USER_ACCOUNT_PATH: z.string().default("m/44'/60'/1'/0"),

  // 주의: 가스 지불 지갑
  OPERATOR_PRIVATE_KEY: z
    .string()
    .regex(HEX_PRIVATE_KEY, 'OPERATOR_PRIVATE_KEY 는 0x + 64자리 hex 여야 합니다'),

  INTERNAL_API_KEY: z.string().min(16, 'INTERNAL_API_KEY 는 16자 이상이어야 합니다'),
});

function fail(reason: string, hint: string): never {
  // 여기서 죽는 게 낫습니다. 환경변수가 틀린 채로 뜨면 엉뚱한 체인에 서명합니다.
  console.error(`\n환경변수 오류\n${reason}\n\n${hint}\n`);
  process.exit(1);
}

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  fail(issues, '.env 가 없으면 만드세요:  npm run setup:env   (각 변수 설명은 .env.example)');
}

/**
 * 검증된 환경변수. **`process.env` 를 직접 읽지 마세요.**
 * 오타가 나도 조용히 `undefined` 가 되고, 그게 체인 위에서 발견됩니다.
 */
export const env = Object.freeze(parsed.data);

export type Env = typeof env;

/* ── 운영 안전장치 ─────────────────────────────────────────────
   Hardhat 이 쓰는 공개 테스트 값은 전 세계가 압니다. 튜토리얼에서 복사해 온 값이
   운영까지 흘러가는 사고가 흔해서, 여기서 한 번 막습니다. */

// 주의: 아래 값들은 쓰라고 적어둔 게 아니라, 거부하려고 적어둔 차단 목록입니다.
//       커밋되는 파일에 키를 두지 않는다는 규칙(DESIGN.md 5-1)의 유일한 예외이고,
//       전부 전 세계에 공개된 Hardhat 기본값이라 여기 있어도 새로 새는 정보가 없습니다.
const PUBLIC_TEST_MNEMONIC = 'test test test test test test test test test test test junk';
const PUBLIC_TEST_KEYS = new Set([
  // Hardhat 기본 계정 #0 · #1
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
]);

if (env.NODE_ENV === 'production') {
  const leaked: string[] = [];

  if (env.MASTER_MNEMONIC.trim().replace(/\s+/g, ' ') === PUBLIC_TEST_MNEMONIC) {
    leaked.push('MASTER_MNEMONIC 이 Hardhat 공개 테스트 니모닉입니다');
  }
  if (PUBLIC_TEST_KEYS.has(env.OPERATOR_PRIVATE_KEY.toLowerCase())) {
    leaked.push('OPERATOR_PRIVATE_KEY 가 Hardhat 공개 테스트 키입니다');
  }
  if (env.CHAIN_ID === 31337) {
    leaked.push('CHAIN_ID 가 31337(로컬 Hardhat)입니다');
  }

  if (leaked.length > 0) {
    fail(
      leaked.map((line) => `  - ${line}`).join('\n'),
      '누구나 개인키를 파생할 수 있는 값입니다. 실제 값을 환경변수로 주입하세요.',
    );
  }
}
