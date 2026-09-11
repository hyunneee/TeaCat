import { ethers, network } from 'hardhat';
import { readDeployment, saveDeployment, type Deployment } from '../lib/deployments';

/** 로컬 노드에서만 되는 치트. 공용 체인에는 이런 게 없습니다. */
const LOCAL_NETWORKS = new Set(['hardhat', 'localhost']);

/**
 * 배포 스크립트.
 *
 * 배포하고, 주소를 `deployments/<network>.json` 에 남깁니다.
 * api 는 그 파일을 읽습니다 — 주소를 코드에 적지 않기 위해서입니다.
 */
async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error('서명 계정이 없습니다. .env 의 OPERATOR_PRIVATE_KEY 를 확인하세요.');
  }

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const balance = await ethers.provider.getBalance(deployer.address);
  const isLocal = LOCAL_NETWORKS.has(network.name);

  // SSAFY 체인은 가스가 무료입니다(gasPrice 0). 잔고 0 이 정상입니다.
  const gasPrice = (await ethers.provider.getFeeData()).gasPrice ?? 0n;
  const gasIsFree = gasPrice === 0n;

  console.log(`network   : ${network.name} (chainId ${chainId})`);
  console.log(`deployer  : ${deployer.address}`);
  console.log(`balance   : ${ethers.formatEther(balance)} ETH`);
  console.log(`gasPrice  : ${gasIsFree ? '0 (가스 무료 체인)' : `${gasPrice} wei`}`);

  if (balance === 0n && !gasIsFree) {
    // 오퍼레이터는 팀 공용 키라 로컬 노드의 니모닉 계정에 없습니다.
    if (isLocal) {
      await ethers.provider.send('hardhat_setBalance', [
        deployer.address,
        '0x21e19e0c9bab2400000', // 10000 ETH
      ]);
      console.log('balance   : 로컬 노드라 10000 ETH 를 채웠습니다');
    } else {
      throw new Error('오퍼레이터 잔고가 0 입니다. 가스를 낼 수 없어 배포할 수 없습니다.');
    }
  }

  const force = process.env.FORCE_REDEPLOY === 'true';

  /* 공용 체인에서는 **이미 배포된 것을 건드리지 않습니다.**

     다시 배포하면 새 주소가 생기고, 먼저 있던 컨트랙트에 남은 잔액과 티켓은
     아무도 안 보는 상태가 됩니다. 되돌릴 방법이 없습니다.

     그래서 있는 것은 주소를 그대로 이어받고 **없는 것만** 배포합니다.
     컨트랙트를 새로 추가할 때 기존 것까지 갈아엎지 않아도 됩니다 —
     예전처럼 전부 아니면 전무로 막아두면, 티켓 하나 올리려고 캣머니를
     재배포해서 유저 잔액을 통째로 버리게 됩니다.

     로컬 체인은 재시작하면 상태가 사라지므로 주소 파일도 무효입니다. 항상 새로 배포합니다. */
  const previous = isLocal ? null : readDeployment(network.name);

  if (previous && force) {
    console.log('');
    console.log('경고: FORCE_REDEPLOY=true — 이미 배포된 컨트랙트까지 전부 새로 배포합니다.');
    console.log('      옛 컨트랙트에 남은 캣머니 잔액과 발행된 티켓은 되찾을 수 없습니다.');
    Object.entries(previous.contracts).forEach(([name, address]) => {
      console.log(`      버려짐  ${name} ${address}`);
    });
    console.log('');
  }

  if (previous && previous.deployer !== deployer.address.toLowerCase()) {
    // 공용 체인에서는 배포한 계정이 그 컨트랙트의 admin 입니다. (DESIGN.md 8장)
    console.log('');
    console.log(`주의: 기존 컨트랙트는 ${previous.deployer} 가 배포했습니다.`);
    console.log(`      지금 계정(${deployer.address})은 그것들의 admin 이 아닙니다.`);
    console.log('');
  }

  const contracts: Record<string, string> = force ? {} : { ...(previous?.contracts ?? {}) };
  const deployedNow: string[] = [];

  /* 아래 함수들은 호이스팅돼서 tsc 가 위쪽의 `if (!deployer)` 검사를 못 믿습니다.
     여기서 한 번 꺼내둡니다. */
  const deployerAddress = deployer.address;

  /**
   * 역할 셋을 정합니다. 한 키가 전부 쥐고 있으면 그 키가 털렸을 때
   * 무제한 발행 + 권한 조작 + 정지 해제가 한꺼번에 가능합니다. (DESIGN.md 6장)
   *
   *   admin    권한을 주고 뺏는 키. **API 프로세스에 올리지 마세요.**
   *   minter   발행 키. api 가 이 키로 서명하므로 오퍼레이터와 같아야 합니다.
   *   operator 정지·해제와 입장 처리. 사고 대응용이라 admin 과 같이 두는 편이 낫습니다.
   *
   * 컨트랙트별 변수(`TICKET_ADMIN_ADDRESS`)가 있으면 그걸 쓰고, 없으면 공용
   * 변수(`CONTRACT_ADMIN_ADDRESS`)를, 그것도 없으면 배포 계정을 씁니다.
   */
  function rolesFor(prefix: string): { admin: string; minter: string; operator: string } {
    const admin =
      process.env[`${prefix}_ADMIN_ADDRESS`] ??
      process.env.CONTRACT_ADMIN_ADDRESS ??
      deployerAddress;
    const operator =
      process.env[`${prefix}_OPERATOR_ADDRESS`] ?? process.env.CONTRACT_OPERATOR_ADDRESS ?? admin;
    return { admin, minter: deployerAddress, operator };
  }

  /**
   * 아직 없는 것만 배포합니다. 이미 있으면 주소를 그대로 씁니다.
   *
   * `withMinter: false` 는 **발행이 없는 컨트랙트**용입니다 (`VerifiableDraw`).
   * 생성자가 `(admin, operator)` 둘만 받습니다 — 없는 역할을 형식만 맞추려고
   * 넘기면, 그 주소가 무슨 권한을 갖는지 배포 로그가 거짓말을 하게 됩니다.
   */
  async function deployOnce(
    name: string,
    roles: { admin: string; minter: string; operator: string },
    options: { withMinter?: boolean } = {},
  ): Promise<void> {
    const withMinter = options.withMinter ?? true;

    const existing = contracts[name];
    if (existing) {
      console.log(`${name} : ${existing}  (이미 배포됨 — 건너뜁니다)`);
      return;
    }

    const shared = withMinter ? roles.minter : roles.operator;
    if (roles.admin.toLowerCase() === shared.toLowerCase()) {
      console.log('');
      console.log(`주의: ${name} 의 admin 과 ${withMinter ? 'minter' : 'operator'} 가 같은 키입니다.`);
      console.log('      이 키가 털리면 권한 조작까지 한꺼번에 가능합니다.');
      console.log('      운영에서는 CONTRACT_ADMIN_ADDRESS 로 분리하세요.');
      console.log('');
    }

    const args = withMinter
      ? [roles.admin, roles.minter, roles.operator]
      : [roles.admin, roles.operator];

    const deployed = await ethers.deployContract(name, args);
    await deployed.waitForDeployment();

    contracts[name] = await deployed.getAddress();
    deployedNow.push(name);

    console.log(`${name} : ${contracts[name]}`);
    console.log(`  admin    ${roles.admin}`);
    if (withMinter) console.log(`  minter   ${roles.minter}`);
    console.log(`  operator ${roles.operator}`);
  }

  console.log('');

  // ── TicketSBT (양도불가 티켓) ──────────────────────────────
  // "암표를 막는다" 가 코드로 증명되는 자리입니다. (DESIGN.md 6장 ①)
  // operator 는 정지 스위치만이 아니라 **입장·취소 처리**도 합니다 —
  // API 가 이 키로 서명하므로 오퍼레이터와 같아야 합니다.
  await deployOnce('TicketSBT', rolesFor('TICKET'));

  // ── CatMoney (캣머니) ──────────────────────────────────────
  // 프론트의 PayMethod='POINT' 가 이 토큰입니다. (DESIGN.md 6장 ②)
  await deployOnce('CatMoney', rolesFor('CATMONEY'));

  // ── PhotocardNFT (포토카드) ────────────────────────────────
  // 티켓과 반대로 **팔라고 만든 물건**입니다. (PHOTOCARD_PLAN.md)
  // operator 가 도안 등록(한정 수량·IPFS URI)과 정지를, minter 가 발행을 맡습니다.
  // 도안 등록을 operator 로 둔 이유: 발행 키가 털려도 한정 수량과 그림은
  // 못 바꾸게 하기 위해서입니다.
  await deployOnce('PhotocardNFT', rolesFor('PHOTOCARD'));

  // ── VerifiableDraw (검증 가능한 추첨) ──────────────────────
  // 토큰을 모릅니다. 난수 하나만 만듭니다. (PHOTOCARD_PLAN.md 4장)
  // 발행이 없어서 minter 도 없습니다 — admin 과 operator 둘뿐입니다.
  //
  // 주의: 리빌에 **약 42분 시한**이 있습니다(블록해시 256개). API 프로세스가
  //       자동으로 부를 수 있어야 하므로 이 operator 키를 API 가 쥐어야 합니다.
  //       (PHOTOCARD_PLAN.md 10장의 미결 항목)
  await deployOnce('VerifiableDraw', rolesFor('DRAW'), { withMinter: false });

  // ── 여기에 추가 ────────────────────────────────────────────
  // 컨트랙트가 늘어나면 위와 같이 deployOnce 를 한 줄씩 붙입니다.
  // ───────────────────────────────────────────────────────────

  if (deployedNow.length === 0) {
    console.log('\n새로 배포한 컨트랙트가 없습니다. 주소 파일을 건드리지 않습니다.');
    return;
  }

  const deployment: Deployment = {
    chainId,
    network: network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts,
  };

  const saved = saveDeployment(deployment);
  console.log(`\n배포 주소 저장 → ${saved}`);
  console.log(`이번에 배포: ${deployedNow.join(', ')} · 전체 ${Object.keys(contracts).length}개`);

  if (!isLocal) {
    console.log('공용 체인입니다. deployments/ssafy.json 을 커밋하세요.');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
