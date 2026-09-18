import type { ContractRunner, ContractTransactionResponse } from 'ethers';
import { ethers, network } from 'hardhat';
import { readDeployment } from '../lib/deployments';

/**
 * 이미 배포된 컨트랙트에 역할을 부여합니다.
 *
 * ── 왜 필요한가 ─────────────────────────────────────────────────────
 * `deploy.ts` 는 **생성자에서 한 번** 역할을 심고, 이미 배포된 컨트랙트는 건너뜁니다.
 * 그래서 나중에 API 지갑이 바뀌면(환경을 새로 띄우거나 키를 갈면) 그 지갑은
 * 아무 권한도 없는 채로 돌게 되고, 쓰기가 전부 이렇게 실패합니다:
 *
 *   execution reverted ... AccessControlUnauthorizedAccount(account, neededRole)
 *
 * 🔴 이 실패는 `estimateGas` 단계에서 나므로 **트랜잭션이 체인에 남지 않습니다.**
 *    탐색기를 봐도 흔적이 없어 원인을 찾기 어렵습니다. 리버트 데이터 앞 4바이트가
 *    0xe2517d3f 이면 이 경우입니다.
 *
 * ── 쓰는 법 ─────────────────────────────────────────────────────────
 *   GRANT_TO=0x… npm run grant:ssafy
 *   GRANT_TO=0x… DRY_RUN=true npm run grant:ssafy    # 계획만 출력
 *
 * 서명 계정은 하드햇 설정이 정합니다 — `blockchain/.env` 의 `OPERATOR_PRIVATE_KEY` 입니다.
 * 🔴 그 키가 **DEFAULT_ADMIN_ROLE 을 쥔 계정**이어야 합니다. 보통 배포 계정입니다.
 *    권한이 없으면 아래에서 미리 막습니다 — 체인에 헛 트랜잭션을 보내지 않기 위해서입니다.
 */

/** AccessControl 부분만 있으면 됩니다. 네 컨트랙트가 모두 이걸 상속합니다. */
const ACCESS_CONTROL_ABI = [
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
  'function MINTER_ROLE() view returns (bytes32)',
  'function OPERATOR_ROLE() view returns (bytes32)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function grantRole(bytes32 role, address account)',
];

/**
 * 위 ABI 에 대응하는 타입.
 *
 * `new ethers.Contract(…)` 는 ABI 를 런타임에 받으므로 메서드가 전부
 * `undefined` 가능으로 잡힙니다. 여기서 한 번만 좁혀 씁니다.
 */
interface AccessControl {
  DEFAULT_ADMIN_ROLE(): Promise<string>;
  MINTER_ROLE(): Promise<string>;
  OPERATOR_ROLE(): Promise<string>;
  hasRole(role: string, account: string): Promise<boolean>;
  grantRole(role: string, account: string): Promise<ContractTransactionResponse>;
}

function accessControlAt(address: string, runner: ContractRunner): AccessControl {
  return new ethers.Contract(address, ACCESS_CONTROL_ABI, runner) as unknown as AccessControl;
}

/**
 * 컨트랙트마다 필요한 역할.
 *
 * 근거는 api 가 어느 지갑으로 서명하느냐입니다 (`api/src/chain/contracts/*.ts`):
 *   MINTER    발행 — operatorSigner() 로 보냅니다
 *   OPERATOR  도안 등록 · 정지 스위치 · 입장 처리 · 추첨 — contractOperatorSigner()
 *
 * 🔴 VerifiableDraw 에는 MINTER_ROLE 이 **없습니다.** 발행이 없는 컨트랙트라
 *    생성자가 (admin, operator) 둘만 받습니다. 넣으면 호출 자체가 실패합니다.
 */
const ROLE_PLAN: Record<string, readonly ('MINTER_ROLE' | 'OPERATOR_ROLE')[]> = {
  TicketSBT: ['MINTER_ROLE', 'OPERATOR_ROLE'],
  CatMoney: ['MINTER_ROLE', 'OPERATOR_ROLE'],
  PhotocardNFT: ['MINTER_ROLE', 'OPERATOR_ROLE'],
  VerifiableDraw: ['OPERATOR_ROLE'],
};

async function main(): Promise<void> {
  const target = process.env.GRANT_TO;
  if (!target || !ethers.isAddress(target)) {
    throw new Error('GRANT_TO 에 역할을 줄 주소를 넣으세요. 예: GRANT_TO=0x… npm run grant:ssafy');
  }

  const dryRun = process.env.DRY_RUN === 'true';

  const [signer] = await ethers.getSigners();
  if (!signer) {
    throw new Error('서명 계정이 없습니다. blockchain/.env 의 OPERATOR_PRIVATE_KEY 를 확인하세요.');
  }

  const deployment = readDeployment(network.name);
  if (!deployment) {
    throw new Error(`${network.name} 에 배포 기록이 없습니다 (deployments/${network.name}.json).`);
  }

  console.log(`network : ${network.name} (chainId ${deployment.chainId})`);
  console.log(`signer  : ${signer.address}`);
  console.log(`target  : ${target}`);
  if (dryRun) console.log('mode    : DRY_RUN — 트랜잭션을 보내지 않습니다');
  console.log('');

  // 자기 자신에게 주는 경우를 막지는 않습니다. 다만 눈에 띄게는 해둡니다 —
  // admin 과 운영 키가 같아지면 키 하나가 털렸을 때 권한 조작까지 가능해집니다.
  if (signer.address.toLowerCase() === target.toLowerCase()) {
    console.log('주의: 서명 계정과 대상이 같습니다. admin 키가 곧 운영 키가 됩니다.');
    console.log('');
  }

  let granted = 0;
  let skipped = 0;

  for (const [name, roleNames] of Object.entries(ROLE_PLAN)) {
    const address = deployment.contracts[name];
    if (!address) {
      console.log(`${name} : 배포 기록에 없습니다 — 건너뜁니다`);
      continue;
    }

    const contract = accessControlAt(address, signer);
    console.log(`${name} : ${address}`);

    // 🔴 권한 확인을 **보내기 전에** 합니다. 없는 채로 grantRole 을 부르면
    //    똑같이 AccessControlUnauthorizedAccount 로 되돌아오는데, 그 실패는
    //    원래 고치려던 증상과 구분이 안 돼 혼란만 커집니다.
    const adminRole = await contract.DEFAULT_ADMIN_ROLE();
    if (!(await contract.hasRole(adminRole, signer.address))) {
      throw new Error(
        `${name}: 서명 계정 ${signer.address} 에 DEFAULT_ADMIN_ROLE 이 없습니다. ` +
          '배포 계정의 키로 다시 실행하세요.',
      );
    }

    for (const roleName of roleNames) {
      // 해시를 코드에 적지 않고 컨트랙트에서 읽습니다. 상수 이름이 바뀌어도
      // 여기가 조용히 틀리는 일이 없습니다.
      const role = await contract[roleName]();

      if (await contract.hasRole(role, target)) {
        console.log(`  ${roleName.padEnd(13)} 이미 있음 — 건너뜁니다`);
        skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`  ${roleName.padEnd(13)} 부여 예정`);
        granted += 1;
        continue;
      }

      // 한 건씩 순서대로 보냅니다. 이 체인은 블록이 약 10초라 병렬로 보내면
      // 논스가 엉키고, 어느 것이 실패했는지도 알기 어려워집니다.
      const tx = await contract.grantRole(role, target);
      const receipt = await tx.wait();
      console.log(`  ${roleName.padEnd(13)} 부여 완료  tx ${receipt?.hash ?? tx.hash}`);
      granted += 1;
    }
  }

  console.log('');
  console.log(dryRun ? `부여 예정 ${granted}건 · 이미 있음 ${skipped}건` : `부여 ${granted}건 · 건너뜀 ${skipped}건`);

  if (dryRun || granted === 0) return;

  // 보낸 것이 실제로 반영됐는지 다시 읽어서 확인합니다.
  // 트랜잭션이 성공했다는 것과 상태가 바뀐 것은 다릅니다 — 여기까지 봐야 끝입니다.
  console.log('');
  console.log('확인:');
  for (const [name, roleNames] of Object.entries(ROLE_PLAN)) {
    const address = deployment.contracts[name];
    if (!address) continue;

    const contract = accessControlAt(address, ethers.provider);
    const results = await Promise.all(
      roleNames.map(async (roleName) => {
        const role = await contract[roleName]();
        const ok = await contract.hasRole(role, target);
        return `${roleName}=${ok ? 'O' : 'X'}`;
      }),
    );
    console.log(`  ${name.padEnd(15)} ${results.join('  ')}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
