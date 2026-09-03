import { readDeployment } from '@teacat/contracts';
import { env, networkNameOf } from '../config';
import { getChainStatus, getOperatorBalanceEth, operatorAddress } from '../chain/provider';

export interface HealthReport {
  status: 'ok' | 'degraded';
  txSender: string;
  chain: {
    connected: boolean;
    expectedChainId: number;
    actualChainId: number | null;
    blockNumber: number | null;
    network: string;
    error?: string;
  };
  operator: {
    address: string;
    balanceEth: string | null;
    /** 가스가 무료인 체인이면 잔고가 0 이어도 정상입니다 */
    gasIsFree: boolean | null;
  };
  /** 배포된 컨트랙트 이름 → 주소. 배포 전이면 빈 객체입니다. */
  contracts: Record<string, string>;
  warnings: string[];
}

export async function buildHealthReport(): Promise<HealthReport> {
  const network = networkNameOf(env.CHAIN_ID);
  const chain = await getChainStatus();
  const balanceEth = chain.connected ? await getOperatorBalanceEth() : null;

  // "체인은 붙었는데 컨트랙트가 없는" 상태를 여기서 확인합니다.
  // 아직 컨트랙트가 하나도 없으므로 비어 있는 게 정상입니다.
  // SSAFY 체인의 배포는 남지만, 로컬 체인은 재시작할 때마다 무효가 됩니다.
  const deployment = readDeployment(network);
  const contracts = deployment?.contracts ?? {};

  const warnings: string[] = [];

  if (!chain.connected) {
    warnings.push(
      `체인에 연결되지 않았습니다. .env 의 RPC_URL(${env.RPC_URL}) 을 확인하세요.`,
    );
  }

  if (chain.chainIdMismatch) {
    warnings.push(
      `chainId 불일치 — .env 는 ${env.CHAIN_ID} 인데 실제 체인은 ${chain.chainId} 입니다. ` +
        `엉뚱한 체인에 서명할 수 있습니다.`,
    );
  }

  // 공용 체인에서는 배포한 계정이 컨트랙트의 admin 입니다.
  // 팀원이 각자 다른 오퍼레이터 키를 쓰면, 남이 배포한 컨트랙트의 onlyOwner 함수가
  // "not owner" 로 막힙니다. 원인을 찾기 어려운 실패라 여기서 미리 알려줍니다.
  if (deployment && Object.keys(contracts).length > 0 && deployment.deployer !== operatorAddress) {
    warnings.push(
      `배포한 계정과 오퍼레이터가 다릅니다 — 배포 ${deployment.deployer}, 지금 ${operatorAddress}. ` +
        `onlyOwner 함수가 막힙니다. 같은 키를 쓰거나 직접 다시 배포하세요.`,
    );
  }

  // SSAFY 체인은 gasPrice 가 0 이라 잔고 0 이 정상입니다.
  // 여기서 무조건 경고하면 /health 가 영원히 degraded 로 남아, 진짜 경고가 묻힙니다.
  if (chain.gasIsFree === false && balanceEth !== null && Number(balanceEth) === 0) {
    warnings.push('오퍼레이터 잔고가 0 입니다. 가스를 낼 수 없어 트랜잭션이 전부 실패합니다.');
  }

  return {
    status: warnings.length === 0 ? 'ok' : 'degraded',
    txSender: env.TX_SENDER,
    chain: {
      connected: chain.connected,
      expectedChainId: env.CHAIN_ID,
      actualChainId: chain.chainId,
      blockNumber: chain.blockNumber,
      network,
      ...(chain.error ? { error: chain.error } : {}),
    },
    operator: {
      address: operatorAddress,
      balanceEth,
      gasIsFree: chain.gasIsFree,
    },
    contracts,
    warnings,
  };
}
