export { env, type Env } from './env';

/** 로컬 Hardhat 체인의 chainId */
export const LOCAL_CHAIN_ID = 31337;

/**
 * SSAFY 체인의 chainId. 팀이 공용으로 쓰는 Besu 네트워크입니다.
 *
 * 가스가 무료라(gasPrice 0) 오퍼레이터 잔고가 0 이어도 트랜잭션이 나갑니다.
 * EVM 은 Constantinople 에서 멈춰 있습니다 — 자세한 건 hardhat.config.ts.
 */
export const SSAFY_CHAIN_ID = 31221;

/**
 * `deployments/<network>.json` 을 찾을 때 쓰는 이름.
 * Hardhat 의 network 이름과 맞아야 합니다.
 */
export function networkNameOf(chainId: number): string {
  switch (chainId) {
    case LOCAL_CHAIN_ID:
      return 'localhost';
    case SSAFY_CHAIN_ID:
      return 'ssafy';
    default:
      return `chain-${chainId}`;
  }
}
