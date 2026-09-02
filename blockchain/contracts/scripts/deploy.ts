import { ethers, network } from 'hardhat';
import { readDeployment, saveDeployment, type Deployment } from '../lib/deployments';

/** 로컬 노드에서만 되는 치트. 공용 체인에는 이런 게 없습니다. */
const LOCAL_NETWORKS = new Set(['hardhat', 'localhost']);

/**
 * 배포 스크립트.
 *
 * 배포하고, 주소를 `deployments/<network>.json` 에 남깁니다.
 * api 는 그 파일을 읽습니다 — 주소를 코드에 적지 않기 위해서입니다.
 *
 * 컨트랙트가 늘어나면 아래 "여기에 추가" 자리에 한 덩어리씩 붙입니다.
 */
async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error('서명 계정이 없습니다. .env 의 OPERATOR_PRIVATE_KEY 를 확인하세요.');
  }

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const balance = await ethers.provider.getBalance(deployer.address);

  // SSAFY 체인은 가스가 무료입니다(gasPrice 0). 잔고 0 이 정상입니다.
  // 가스가 유료인 체인에서만 잔고를 막아야 합니다 — 무료 체인에서 막으면
  // 배포가 아예 안 됩니다.
  const gasPrice = (await ethers.provider.getFeeData()).gasPrice ?? 0n;
  const gasIsFree = gasPrice === 0n;

  console.log(`network   : ${network.name} (chainId ${chainId})`);
  console.log(`deployer  : ${deployer.address}`);
  console.log(`balance   : ${ethers.formatEther(balance)} ETH`);
  console.log(`gasPrice  : ${gasIsFree ? '0 (가스 무료 체인)' : `${gasPrice} wei`}`);

  if (balance === 0n && !gasIsFree) {
    // 오퍼레이터는 팀 공용 키라 로컬 노드의 니모닉 계정에 없습니다.
    // 로컬에서는 그냥 채워주면 됩니다 — 공용 키를 쓰려고 로컬 체인을 포기할 이유가 없습니다.
    if (LOCAL_NETWORKS.has(network.name)) {
      await ethers.provider.send('hardhat_setBalance', [
        deployer.address,
        '0x21e19e0c9bab2400000', // 10000 ETH
      ]);
      console.log('balance   : 로컬 노드라 10000 ETH 를 채웠습니다');
    } else {
      throw new Error('오퍼레이터 잔고가 0 입니다. 가스를 낼 수 없어 배포할 수 없습니다.');
    }
  }

  // 공용 체인에 이미 배포된 게 있으면 덮어쓰기 전에 알려줍니다.
  // 다시 배포하면 새 주소가 생기고, 먼저 있던 컨트랙트는 체인에 그대로 남아
  // 아무도 안 보는 상태가 됩니다. 발행된 티켓도 옛 주소에 남습니다.
  if (!LOCAL_NETWORKS.has(network.name)) {
    const previous = readDeployment(network.name);
    const previousCount = Object.keys(previous?.contracts ?? {}).length;
    if (previous && previousCount > 0) {
      console.log('');
      console.log(`주의: ${network.name}.json 에 이미 컨트랙트 ${previousCount}개가 있습니다.`);
      console.log(`      ${previous.deployedAt} · ${previous.deployer} 가 배포`);
      console.log('      지금 배포하면 주소가 새로 생기고, 옛 컨트랙트의 티켓은 거기 남습니다.');
      console.log('');
    }
  }

  const contracts: Record<string, string> = {};

  // ── CatMoney (캣머니) ──────────────────────────────────────
  // 프론트의 PayMethod='POINT' 가 이 토큰입니다. (DESIGN.md 6장 ②)
  //
  // 배포 계정이 admin · minter · operator 를 모두 갖습니다.
  // 운영에서는 발행 권한을 별도 지갑으로 분리하세요 — 발행 키가 털리면
  // 무제한 발행이 됩니다. (역할은 나중에 grantRole/revokeRole 로 옮길 수 있습니다)
  const catMoney = await ethers.deployContract('CatMoney', [deployer.address]);
  await catMoney.waitForDeployment();
  contracts.CatMoney = await catMoney.getAddress();
  console.log(`CatMoney  : ${contracts.CatMoney}`);

  // ── 여기에 추가 ────────────────────────────────────────────
  // 컨트랙트가 늘어나면 위와 같은 모양으로 한 덩어리씩 붙입니다.
  //
  // 배포 계정이 admin 이 됩니다. 운영에 올릴 때는 admin 을 별도 지갑으로
  // 분리하세요 — 키 하나가 털리면 전부 끝납니다.
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

  // 공용 체인이면 이 파일을 커밋해야 팀원이 같은 주소를 씁니다.
  if (network.name === 'ssafy') {
    console.log('공용 체인입니다. deployments/ssafy.json 을 커밋하세요.');
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
