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

  /* 공용 체인에 이미 배포돼 있으면 **멈춥니다.**
     다시 배포하면 새 주소가 생기고, 먼저 있던 컨트랙트에 남은 잔액과 티켓은
     아무도 안 보는 상태가 됩니다. 되돌릴 방법이 없습니다.
     경고만 찍고 진행하면 실수 한 번으로 그 일이 벌어집니다. */
  if (!isLocal) {
    const previous = readDeployment(network.name);
    const previousCount = Object.keys(previous?.contracts ?? {}).length;

    if (previous && previousCount > 0 && process.env.FORCE_REDEPLOY !== 'true') {
      throw new Error(
        `${network.name}.json 에 이미 컨트랙트 ${previousCount}개가 있습니다.\n` +
          `  ${previous.deployedAt} · ${previous.deployer} 가 배포\n` +
          `  ${Object.entries(previous.contracts)
            .map(([name, addr]) => `${name} ${addr}`)
            .join('\n  ')}\n\n` +
          `다시 배포하면 주소가 새로 생기고, 옛 컨트랙트에 남은 잔액은 되찾을 수 없습니다.\n` +
          `그래도 배포하려면:  FORCE_REDEPLOY=true npm run deploy:ssafy`,
      );
    }
  }

  const contracts: Record<string, string> = {};

  // ── CatMoney (캣머니) ──────────────────────────────────────
  // 프론트의 PayMethod='POINT' 가 이 토큰입니다. (DESIGN.md 6장 ②)
  //
  // 역할을 셋으로 나눠 넘깁니다. 한 키가 전부 쥐고 있으면 그 키가 털렸을 때
  // 무제한 발행 + 권한 조작 + 정지 해제가 한꺼번에 가능합니다.
  //
  //   admin    권한을 주고 뺏는 키. **API 프로세스에 올리지 마세요.**
  //   minter   발행 키. api 가 이 키로 서명하므로 오퍼레이터와 같아야 합니다.
  //   operator 정지·해제. 사고 대응용이라 admin 과 같이 두는 편이 낫습니다.
  const admin = process.env.CATMONEY_ADMIN_ADDRESS ?? deployer.address;
  const minter = deployer.address;
  const operator = process.env.CATMONEY_OPERATOR_ADDRESS ?? admin;

  if (admin.toLowerCase() === minter.toLowerCase()) {
    console.log('');
    console.log('주의: admin 과 minter 가 같은 키입니다.');
    console.log('      이 키가 털리면 무제한 발행·권한 조작·정지 해제가 전부 가능합니다.');
    console.log('      운영에서는 CATMONEY_ADMIN_ADDRESS 로 분리하세요.');
    console.log('');
  }

  const catMoney = await ethers.deployContract('CatMoney', [admin, minter, operator]);
  await catMoney.waitForDeployment();
  contracts.CatMoney = await catMoney.getAddress();
  console.log(`CatMoney  : ${contracts.CatMoney}`);
  console.log(`  admin    ${admin}`);
  console.log(`  minter   ${minter}`);
  console.log(`  operator ${operator}`);

  // ── 여기에 추가 ────────────────────────────────────────────
  // 컨트랙트가 늘어나면 위와 같은 모양으로 한 덩어리씩 붙입니다.
  // ───────────────────────────────────────────────────────────

  const deployment: Deployment = {
    chainId,
    network: network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts,
  };

  const saved = saveDeployment(deployment);
  console.log(`\n배포 주소 저장 → ${saved}`);
  console.log(`컨트랙트 ${Object.keys(contracts).length}개`);

  if (!isLocal) {
    console.log('공용 체인입니다. deployments/ssafy.json 을 커밋하세요.');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
