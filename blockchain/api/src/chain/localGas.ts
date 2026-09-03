import { env } from '../config';
import { provider } from './provider';

/**
 * **로컬 체인에서만** 유저 지갑에 가스를 채웁니다.
 *
 * SSAFY 체인은 가스가 무료라(gasPrice 0) 유저 잔고가 0 이어도 트랜잭션이 나갑니다.
 * 그래서 소각·전송을 유저 본인이 서명해도 문제가 없습니다.
 *
 * 로컬 Hardhat 은 가스를 받습니다. 그대로 두면 유저 지갑에 ETH 가 없어
 * **결제 경로를 로컬에서 한 번도 못 돌려봅니다.** 그 간극만 메웁니다.
 *
 * 운영에서는 돌지 않습니다 — 세 겹으로 막혀 있습니다.
 *   1. NODE_ENV=production 이면 즉시 반환
 *   2. gasPrice 가 0 이면(= SSAFY 체인) 필요가 없으므로 반환
 *   3. `hardhat_setBalance` 는 로컬 노드에만 있습니다. 없으면 조용히 넘어가고
 *      전송이 원래대로 실패합니다
 */
export async function ensureLocalGas(address: string): Promise<void> {
  if (env.NODE_ENV === 'production') return;

  const gasPrice = (await provider.getFeeData()).gasPrice ?? 0n;
  if (gasPrice === 0n) return;

  if ((await provider.getBalance(address)) > 0n) return;

  try {
    await provider.send('hardhat_setBalance', [address, '0xde0b6b3a7640000']); // 1 ETH
  } catch {
    // 로컬 노드가 아닙니다. 여기서 던지면 진짜 원인이 가려지므로 그냥 넘어갑니다.
  }
}
