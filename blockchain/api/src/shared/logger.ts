/**
 * 아주 얇은 로거.
 *
 * 존재 이유의 절반은 **마스킹**입니다. 니모닉·개인키가 로그로 새는 사고는
 * 대개 간접적으로 납니다 — `console.log(wallet)`, 에러 객체 통째 직렬화,
 * 요청/응답 전체 로깅. (DESIGN.md 5-1)
 */

const SECRET_PATTERNS: RegExp[] = [
  // 0x + 64 hex — 개인키
  /\b0x[0-9a-fA-F]{64}\b/g,
  // 12/15/18/21/24 단어 니모닉
  /\b(?:[a-z]{3,8}\s+){11,23}[a-z]{3,8}\b/g,
];

/**
 * 주의: **전부 소문자로 적습니다.** 아래에서 `key.toLowerCase()` 와 비교하므로
 *       `privateKey` 처럼 대문자가 섞이면 영원히 안 맞아 마스킹이 조용히 무력해집니다.
 */
const SECRET_KEYS = [
  'mnemonic',
  'privatekey',
  'private_key',
  'signingkey',
  'signing_key',
  'secret',
  'password',
  'authorization',
  'x-internal-key',
  'seed',
];

function maskString(value: string): string {
  return SECRET_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '[REDACTED]'), value);
}

function mask(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]';
  if (typeof value === 'string') return maskString(value);
  if (typeof value === 'bigint') return value.toString();
  if (value === null || typeof value !== 'object') return value;

  if (value instanceof Error) {
    return { name: value.name, message: maskString(value.message) };
  }

  if (Array.isArray(value)) return value.map((item) => mask(item, depth + 1));

  // ethers Wallet 처럼 개인키를 품은 객체는 통째로 막습니다.
  const record = value as Record<string, unknown>;
  if ('privateKey' in record || 'mnemonic' in record) return '[REDACTED_WALLET]';

  return Object.fromEntries(
    Object.entries(record).map(([key, val]) =>
      SECRET_KEYS.includes(key.toLowerCase()) ? [key, '[REDACTED]'] : [key, mask(val, depth + 1)],
    ),
  );
}

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, message: string, meta?: unknown): void {
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${maskString(message)}`;
  const payload = meta === undefined ? '' : ` ${JSON.stringify(mask(meta))}`;

  if (level === 'error') console.error(line + payload);
  else if (level === 'warn') console.warn(line + payload);
  else console.log(line + payload);
}

export const logger = {
  info: (message: string, meta?: unknown) => emit('info', message, meta),
  warn: (message: string, meta?: unknown) => emit('warn', message, meta),
  error: (message: string, meta?: unknown) => emit('error', message, meta),
};

/**
 * 해시·txHash 를 로그용으로 앞부분만 남깁니다.
 *
 * 이 값들은 개인키와 모양이 같아서(0x + 64 hex) 위 마스킹이 통째로 [REDACTED] 로
 * 가립니다. 마스킹이 잘못된 게 아니라 **모양만으로는 구분할 수 없기 때문**입니다.
 * 줄여서 남기면 대사(reconciliation)에 쓸 만큼은 식별되고, 혹시 비밀값이 흘러와도
 * 의미 있는 양이 새지 않습니다. 전체 값은 API 응답과 온체인에 있습니다.
 */
export function short(hex: string): string {
  return `${hex.slice(0, 18)}…`;
}
