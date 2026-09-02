import * as path from 'node:path';
import * as dotenv from 'dotenv';
import '@nomicfoundation/hardhat-toolbox';
import type { HardhatUserConfig } from 'hardhat/config';

// .env 는 blockchain/ 루트에 하나만 둡니다. api 와 같은 파일을 읽습니다.
// 없으면 만드세요:  npm run setup:env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MASTER_MNEMONIC = process.env.MASTER_MNEMONIC ?? '';
const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY ?? '';

/**
 * SLOW_CHAIN=true 면 로컬 체인이 10초마다 블록을 만듭니다.
 *
 * 로컬 체인은 기본적으로 즉시 확정돼서 "보내고 바로 읽기" 같은 코드가 통과해버립니다.
 * SSAFY 체인은 블록이 약 10초이므로 그 코드는 거기서 무너집니다.
 * 통합 테스트 때 켜서 미리 잡습니다. (DESIGN.md 8장)
 */
const slowMining = process.env.SLOW_CHAIN === 'true';

/** SSAFY 체인. 팀이 공용으로 쓰는 Besu 네트워크입니다. */
const SSAFY_CHAIN_ID = 31221;
const SSAFY_RPC_URL = 'https://rpc.ssafy-blockchain.com';

/**
 * SSAFY 체인의 EVM 은 **Constantinople** 에서 멈춰 있습니다. (Besu v22.7.2)
 *
 * 실제로 노드에 물어보고 확인한 것입니다 — 아래 옵코드가 전부 invalid 로 죽습니다.
 *
 *   CHAINID(0x46) · SELFBALANCE(0x47)  Istanbul
 *   BASEFEE(0x48)                      London
 *   PUSH0(0x5f)                        Shanghai
 *   MCOPY(0x5e) · TSTORE(0x5d)         Cancun
 *
 * 그래서 컴파일 타깃을 낮춥니다. 이걸 올려두면 **컴파일은 통과하는데 배포가 실패합니다.**
 * solc 0.8.20+ 는 기본적으로 0 을 PUSH0 으로 넣기 때문에, cancun/shanghai 로 컴파일한
 * 바이트코드는 생성자 첫 줄(`575f5ffd`)에서 그대로 죽습니다.
 *
 * 낮춰두면 solc 가 컴파일 단계에서 막아줍니다 — `block.chainid` 를 쓰면 그 자리에서
 * 에러가 납니다. 체인 위에서 발견하는 것보다 훨씬 낫습니다.
 *
 * 주의: 이 제약 때문에 `block.chainid` 가 필요한 것들은 이 체인에 올릴 수 없습니다.
 *       EIP-712 서명(permit 류)과 **ERC-4337 EntryPoint** 가 여기 걸립니다. (DESIGN.md 9장 M4)
 */
const EVM_VERSION = 'constantinople';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      evmVersion: EVM_VERSION,
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // `hardhat test` 가 쓰는 메모리 체인.
    // 주의: hardfork 를 SSAFY 체인과 맞춰둡니다. 여기만 최신 EVM 이면
    //       테스트는 전부 통과하는데 배포가 실패하는 상황이 생깁니다.
    hardhat: {
      chainId: 31337,
      hardfork: EVM_VERSION,
      // .env 의 니모닉으로 계정을 만들어 각각 10000 ETH 를 채웁니다.
      ...(MASTER_MNEMONIC ? { accounts: { mnemonic: MASTER_MNEMONIC } } : {}),
      mining: slowMining ? { auto: false, interval: 10_000 } : { auto: true },
    },
    // 이미 떠 있는 로컬 노드(`npm run chain`)에 붙을 때.
    // SSAFY 체인은 10초에 한 블록이라 반복 작업이 느립니다. 빠르게 돌려볼 때 씁니다.
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
      accounts: OPERATOR_PRIVATE_KEY ? [OPERATOR_PRIVATE_KEY] : [],
    },
    // 팀 공용 SSAFY 체인. 실제 배포는 여기로 갑니다.
    //
    // gasPrice 0 — 이 체인은 가스가 무료입니다. 잔고가 0 이어도 트랜잭션이 나갑니다.
    // 명시하지 않으면 ethers/hardhat 이 EIP-1559 필드를 붙이려다 실패합니다.
    // (이 체인은 London 이전이라 baseFeePerGas 자체가 없습니다)
    ssafy: {
      url: process.env.RPC_URL ?? SSAFY_RPC_URL,
      chainId: SSAFY_CHAIN_ID,
      accounts: OPERATOR_PRIVATE_KEY ? [OPERATOR_PRIVATE_KEY] : [],
      gasPrice: 0,
    },
  },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
  },
};

export default config;
