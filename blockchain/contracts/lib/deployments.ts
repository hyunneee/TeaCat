import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * 배포 주소 파일.
 *
 * 컨트랙트 주소를 코드에 하드코딩하지 않습니다. 로컬 체인은 재시작할 때마다
 * 주소가 바뀌고, 팀원마다 자기 체인을 띄우므로 값도 제각각입니다.
 * 배포 스크립트가 이 파일을 쓰고, api 는 이 파일을 읽습니다. (DESIGN.md 12장)
 */
export interface Deployment {
  /** 어느 체인에 배포됐는지 */
  chainId: number;
  network: string;
  /** 배포한 계정 (오퍼레이터) */
  deployer: string;
  deployedAt: string;
  /** 컨트랙트 이름 → 주소 (소문자 정규화 — DESIGN.md 4-7) */
  contracts: Record<string, string>;
}

const DEPLOYMENTS_DIR = path.resolve(__dirname, '../deployments');

function filePathFor(network: string): string {
  return path.join(DEPLOYMENTS_DIR, `${network}.json`);
}

export function saveDeployment(deployment: Deployment): string {
  fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });

  const target = filePathFor(deployment.network);
  const normalized: Deployment = {
    ...deployment,
    deployer: deployment.deployer.toLowerCase(),
    contracts: Object.fromEntries(
      Object.entries(deployment.contracts).map(([name, address]) => [name, address.toLowerCase()]),
    ),
  };

  fs.writeFileSync(target, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return target;
}

export function readDeployment(network: string): Deployment | null {
  const target = filePathFor(network);
  if (!fs.existsSync(target)) return null;
  return JSON.parse(fs.readFileSync(target, 'utf8')) as Deployment;
}

/**
 * 배포된 컨트랙트 주소를 가져옵니다. 없으면 던집니다 —
 * 주소가 없는 채로 조용히 넘어가면 엉뚱한 곳에 트랜잭션을 보내게 됩니다.
 */
export function requireAddress(network: string, contractName: string): string {
  const deployment = readDeployment(network);
  if (!deployment) {
    throw new Error(
      `[deployments] ${network}.json 이 없습니다. 먼저 배포하세요:  npm run chain:reset`,
    );
  }

  const address = deployment.contracts[contractName];
  if (!address) {
    throw new Error(
      `[deployments] ${network}.json 에 "${contractName}" 이 없습니다. ` +
        `배포된 것: ${Object.keys(deployment.contracts).join(', ') || '(없음)'}`,
    );
  }

  return address;
}
