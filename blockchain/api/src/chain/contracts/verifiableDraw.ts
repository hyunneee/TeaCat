import { AbiCoder, ZeroHash, keccak256 } from 'ethers';
import { VerifiableDraw__factory, readDeployment, type VerifiableDraw } from '@teacat/contracts';
import { env, networkNameOf } from '../../config';
import { contractOperatorAddress, contractOperatorSigner, provider } from '../provider';
import { ensureLocalGas } from '../localGas';
import { sendSerialized } from '../nonce';
import { hashOf } from '../hash';

/**
 * 검증 가능한 추첨. (PHOTOCARD_PLAN.md 4장)
 *
 * **체인이 만드는 것은 난수 하나뿐입니다.** 배정은 그 난수로부터 계산되는 순수
 * 함수(`assign`)라 누가 실행하든 같은 답이 나옵니다 — 그래서 온체인에 두지 않습니다.
 *
 * 이 모듈이 `assign` 까지 들고 있는 이유는 keccak256 이 필요해서입니다.
 * `ethers` 는 `chain/` 밖으로 나가지 않습니다 (4-1).
 *
 * 전부 `OPERATOR_ROLE` 입니다 — 발행 키로는 아무것도 못 합니다.
 */

const CONTRACT_NAME = 'VerifiableDraw';

const abi = AbiCoder.defaultAbiCoder();

/**
 * `blockhash` 가 돌려주는 과거 블록 수. **컨트랙트의 `BLOCKHASH_WINDOW` 와 같아야 합니다.**
 *
 * 이 체인은 블록이 약 10초라 대략 42분입니다. 그 안에 리빌하지 못하면 그 추첨은
 * 되살릴 수 없습니다.
 */
const BLOCKHASH_WINDOW = 256;

/** 커밋에 묶이는 입력. **순서까지 의미가 있습니다.** */
export interface DrawInputs {
  performanceId: bigint;
  /** `status = CONFIRMED` 인 티켓 id — **오름차순** */
  ticketIds: bigint[];
  /** 도안 id — **오름차순** */
  designIds: bigint[];
  /** `designIds` 와 같은 순서. 합계가 `ticketIds` 길이와 같아야 합니다 */
  quantities: bigint[];
}

export interface OnChainDraw {
  exists: boolean;
  seedCommit: string;
  inputsHash: string;
  commitBlock: number;
  /** 난수에 섞을 블록. 커밋 다음 블록입니다 */
  targetBlock: number;
  revealed: boolean;
  canceled: boolean;
  /** 리빌 전이면 null */
  randomness: string | null;
}

export interface Assignment {
  ticketId: bigint;
  designId: bigint;
}

export function verifiableDrawAddress(): string | null {
  const deployment = readDeployment(networkNameOf(env.CHAIN_ID));
  return deployment?.contracts[CONTRACT_NAME] ?? null;
}

function requireAddress(): string {
  const address = verifiableDrawAddress();
  if (address === null) {
    throw new Error(`${CONTRACT_NAME} 이 ${networkNameOf(env.CHAIN_ID)} 에 배포되지 않았습니다`);
  }
  return address;
}

function read(): VerifiableDraw {
  return VerifiableDraw__factory.connect(requireAddress(), provider);
}

function asOperator(): VerifiableDraw {
  return VerifiableDraw__factory.connect(requireAddress(), contractOperatorSigner());
}

// ── 키와 해시 ─────────────────────────────────────────────────

/** `drawKey` 문자열 → 온체인 `drawId`. */
export function drawIdOf(drawKey: string): string {
  return hashOf(drawKey);
}

/**
 * 참여자·수량을 묶은 해시.
 *
 * **이게 이 설계의 핵심입니다.** 난수만 고정하고 입력을 안 고정하면, 서버가 결과를
 * 본 뒤 참여자 순서를 바꿔 원하는 사람에게 원하는 도안을 줄 수 있습니다 —
 * 난수는 진짜인데 배정은 조작인 상태가 됩니다. (PHOTOCARD_PLAN.md 4-3)
 *
 * `abi.encode` 를 씁니다. `encodePacked` 는 배열 경계가 뭉개져서 서로 다른 입력이
 * 같은 해시가 될 수 있습니다.
 */
export function inputsHashOf(inputs: DrawInputs): string {
  return keccak256(
    abi.encode(
      ['uint256', 'uint256[]', 'uint256[]', 'uint256[]'],
      [inputs.performanceId, inputs.ticketIds, inputs.designIds, inputs.quantities],
    ),
  );
}

/**
 * 시드. **저장하지 않고 매번 파생합니다.**
 *
 * 커밋과 리빌 사이에 시드를 어딘가 들고 있어야 하는데 이 서비스는 상태가 없습니다.
 * 지갑과 같은 방법을 씁니다 — 비밀에서 파생하면 재시작해도 같은 값이 나옵니다.
 * (DESIGN.md 4-6)
 *
 * 비밀이 없으면 **던집니다.** 조용히 고정값으로 떨어지면 모든 추첨의 시드가 같아져서,
 * 커밋을 보는 순간 누구나 결과를 계산할 수 있게 됩니다.
 */
function seedOf(drawId: string): string {
  if (!env.DRAW_SEED_SECRET) {
    throw new Error('DRAW_SEED_SECRET 이 없습니다 — 추첨 시드를 파생할 수 없습니다');
  }
  return keccak256(abi.encode(['bytes32', 'bytes32'], [hashOf(env.DRAW_SEED_SECRET), drawId]));
}

/** 컨트랙트의 `keccak256(abi.encode(seed))` 와 같은 식이어야 합니다. */
function commitOf(seed: string): string {
  return keccak256(abi.encode(['bytes32'], [seed]));
}

/** 추첨 경로를 쓸 수 있는 상태인지. 서비스가 503 으로 바꿉니다. */
export function drawSeedConfigured(): boolean {
  return env.DRAW_SEED_SECRET !== undefined;
}

// ── 배정 ──────────────────────────────────────────────────────

/**
 * 배정 계산. **Spring·이 서비스·제3자가 같은 값을 내야 합니다.**
 * (PHOTOCARD_PLAN.md 4-4)
 *
 * `Collections.shuffle(list, SecureRandom)` 류를 쓰지 않는 이유는 재현되지 않아서
 * 입니다. 난수를 체인 값에서 뽑는 Fisher-Yates 로 못 박습니다 — 이 식이 바뀌면
 * 이미 발행된 카드의 배정이 검증되지 않습니다.
 *
 * 순수 함수입니다. 체인을 타지 않습니다.
 */
export function assign(randomness: string, inputs: DrawInputs): Assignment[] {
  const pool: bigint[] = [];
  for (let d = 0; d < inputs.designIds.length; d++) {
    const designId = inputs.designIds[d]!;
    for (let q = 0n; q < inputs.quantities[d]!; q++) pool.push(designId);
  }

  if (pool.length !== inputs.ticketIds.length) {
    throw new Error(
      `수량 합계(${pool.length})가 참여자 수(${inputs.ticketIds.length})와 다릅니다`,
    );
  }

  for (let i = pool.length - 1; i >= 1; i--) {
    const drawn = BigInt(keccak256(abi.encode(['bytes32', 'uint256'], [randomness, i])));
    const j = Number(drawn % BigInt(i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  return inputs.ticketIds.map((ticketId, k) => ({ ticketId, designId: pool[k]! }));
}

// ── 조회 ──────────────────────────────────────────────────────

export async function getDraw(drawKey: string): Promise<OnChainDraw> {
  const [exists, seedCommit, inputsHash, commitBlock, targetBlock, revealed, canceled, randomness] =
    await read().getDraw(drawIdOf(drawKey));

  return {
    exists,
    seedCommit,
    inputsHash,
    commitBlock: Number(commitBlock),
    targetBlock: Number(targetBlock),
    revealed,
    canceled,
    // 리빌 전에는 0 입니다. 서비스가 난수인 척 다루지 않도록 여기서 null 로 바꿉니다.
    randomness: revealed && randomness !== ZeroHash ? randomness : null,
  };
}

/**
 * 지금 리빌을 보내도 되는가.
 *
 * 대상 블록이 생겼고(`TooEarly` 방지) 아직 256블록 안이어야(`BlockhashExpired` 방지)
 * 합니다. **보내기 전에 확인합니다** — 안 보면 202 를 돌려준 뒤 실패를 뒤늦게 압니다.
 */
export async function isRevealable(draw: OnChainDraw): Promise<boolean> {
  if (!draw.exists || draw.revealed || draw.canceled) return false;

  const now = await provider.getBlockNumber();
  return now > draw.targetBlock && now - draw.targetBlock <= BLOCKHASH_WINDOW;
}

/** 블록해시가 사라져 되살릴 수 없게 됐는가. 취소만 남은 상태입니다. */
export async function isExpired(draw: OnChainDraw): Promise<boolean> {
  if (!draw.exists || draw.revealed || draw.canceled) return false;

  const now = await provider.getBlockNumber();
  return now - draw.targetBlock > BLOCKHASH_WINDOW;
}

// ── 쓰기 ──────────────────────────────────────────────────────
// 전부 `OPERATOR_ROLE` 이라 논스를 그 주소로 셉니다.

/**
 * 추첨을 엽니다 — 커밋.
 *
 * 시드는 올라가지 않습니다. 해시만 올려서 서버를 그 시드에 묶어둡니다.
 * 참여자·수량도 `inputsHash` 로 **같은 트랜잭션에서** 고정됩니다.
 */
export async function openDraw(drawKey: string, inputs: DrawInputs): Promise<string> {
  const drawId = drawIdOf(drawKey);
  const seedCommit = commitOf(seedOf(drawId));
  const inputsHash = inputsHashOf(inputs);

  await ensureLocalGas(contractOperatorAddress);

  return sendSerialized(contractOperatorAddress, async (nonce) => {
    const tx = await asOperator().openDraw(drawId, seedCommit, inputsHash, { nonce });
    return tx.hash;
  });
}

/**
 * 시드를 공개해 난수를 확정합니다 — 리빌.
 *
 * 시드를 인자로 받지 않습니다. 비밀에서 다시 파생하므로 **커밋한 것과 반드시 같습니다** —
 * 손으로 넘기게 두면 틀린 값이 들어와 `SeedMismatch` 로 죽는 경로가 생깁니다.
 *
 * ⚠️ **약 42분 시한이 있습니다.** 커밋 응답을 받으면 바로 예약하세요.
 */
export async function revealDraw(drawKey: string): Promise<string> {
  return revealDrawById(drawIdOf(drawKey));
}

/**
 * `drawId` 로 직접 리빌합니다. **자동 리빌 감시가 씁니다.**
 *
 * 시드가 `drawKey` 가 아니라 **해시된 `drawId` 에서** 파생되기 때문에 원문 키를
 * 몰라도 공개할 수 있습니다. 그래서 감시가 체인의 이벤트만 보고 복구할 수 있습니다.
 */
export async function revealDrawById(drawId: string): Promise<string> {
  const seed = seedOf(drawId);

  await ensureLocalGas(contractOperatorAddress);

  return sendSerialized(contractOperatorAddress, async (nonce) => {
    const tx = await asOperator().revealDraw(drawId, seed, { nonce });
    return tx.hash;
  });
}

/**
 * 아직 공개되지 않은 추첨을 **체인에서 직접 찾습니다.** 자동 리빌의 안전망입니다.
 *
 * ── 왜 이게 되는가 ────────────────────────────────────────────────
 * 이 서비스는 상태가 없어서, 재시작하면 "무엇을 공개해야 하는지" 를 잃습니다.
 * 그런데 **블록해시 창이 곧 우리가 봐야 할 범위**입니다 — 256블록보다 오래된
 * 추첨은 어차피 되살릴 수 없으므로 찾을 이유가 없습니다.
 *
 * 그래서 최근 256블록의 `DrawOpened` 로그만 훑으면 **복구해야 할 것이 전부 나옵니다.**
 * DB 도 메모리도 필요 없습니다.
 */
export async function pendingDrawIds(): Promise<string[]> {
  const now = await provider.getBlockNumber();
  const contract = read();

  const opened = await contract.queryFilter(
    contract.filters.DrawOpened(),
    Math.max(0, now - BLOCKHASH_WINDOW),
    now,
  );

  const pending: string[] = [];
  for (const event of opened) {
    const drawId = event.args.drawId;
    const [, , , , targetBlock, revealed, canceled] = await contract.getDraw(drawId);
    if (revealed || canceled) continue;

    // 아직 대상 블록이 안 생겼거나 창을 넘겼으면 지금 보낼 것이 없습니다.
    const target = Number(targetBlock);
    if (now <= target || now - target > BLOCKHASH_WINDOW) continue;

    pending.push(drawId);
  }
  return pending;
}

/**
 * 되살릴 수 없게 된 추첨을 접습니다.
 *
 * 컨트랙트가 **리빌이 아직 가능한 동안에는 거부합니다.** 접어도 그 `drawKey` 는
 * 풀리지 않으므로, 다시 뽑으려면 새 키로 열어야 하고 그 기록이 체인에 남습니다.
 */
export async function cancelDraw(drawKey: string): Promise<string> {
  await ensureLocalGas(contractOperatorAddress);

  return sendSerialized(contractOperatorAddress, async (nonce) => {
    const tx = await asOperator().cancelDraw(drawIdOf(drawKey), { nonce });
    return tx.hash;
  });
}
