import { deriveUserAddress, derivationPath } from '../chain/keys/hdWallet';

export interface WalletResult {
  address: string;
  derivationIndex: number;
  path: string;
  /** 릴레이어 단계에서는 EOA, M4 부터 SMART_ACCOUNT (DESIGN.md 5-3 wallets.type) */
  type: 'RELAYER_EOA';
}

/**
 * 파생 인덱스로 유저 지갑 주소를 계산합니다.
 *
 * **저장하지 않습니다.** 결과를 DB 에 넣는 건 Spring 입니다. (DESIGN.md 1장)
 * 같은 인덱스로 몇 번을 불러도 같은 주소가 나오므로 재시도가 안전합니다.
 */
export function resolveWallet(derivationIndex: number): WalletResult {
  return {
    address: deriveUserAddress(derivationIndex),
    derivationIndex,
    path: derivationPath(derivationIndex),
    type: 'RELAYER_EOA',
  };
}
