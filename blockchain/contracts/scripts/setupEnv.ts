import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HDNodeWallet, Wallet } from 'ethers';

/**
 * `.env` 를 만들어줍니다.
 *
 * 커밋되는 파일에는 키 형태의 값을 하나도 두지 않는다는 규칙 때문에
 * (`.env.example` 은 설명만 있습니다) 각자 로컬에서 무작위로 생성합니다.
 *
 * 니모닉이 사람마다 다르므로 유저 주소도 사람마다 다릅니다.
 * 각자 자기 로컬 체인을 쓰니 문제가 되지 않습니다.
 */
const ROOT = path.resolve(__dirname, '../..');
const ENV_PATH = path.join(ROOT, '.env');

/** 오퍼레이터 파생 경로. Hardhat 로컬 노드가 자금을 채워주는 자리와 같습니다. */
const OPERATOR_PATH = "m/44'/60'/0'/0/0";
const USER_ACCOUNT_PATH = "m/44'/60'/1'/0";

/** SSAFY 체인 — 팀 공용 Besu 네트워크. 가스가 무료라 키를 새로 만들어도 바로 씁니다. */
const SSAFY_CHAIN_ID = 31221;
const SSAFY_RPC_URL = 'https://rpc.ssafy-blockchain.com';

function build(): string {
  const mnemonic = Wallet.createRandom().mnemonic?.phrase;
  if (!mnemonic) throw new Error('니모닉 생성에 실패했습니다');

  const operator = HDNodeWallet.fromPhrase(mnemonic, undefined, OPERATOR_PATH);
  const internalApiKey = randomBytes(24).toString('hex');

  return `# 이 파일은 npm run setup:env 가 만들었습니다. 커밋되지 않습니다.
# 각 변수의 의미는 .env.example 을 보세요.
# 값을 바꿔도 됩니다. 처음부터 다시 만들려면 이 파일을 지우고 setup:env 를 다시 돌리세요.
#
# 주의: 여기 있는 니모닉·개인키를 운영에 쓰지 마세요. 개발 전용으로 만들어진 값입니다.

NODE_ENV=development
PORT=4000

# SSAFY 체인 (팀 공용). 가스가 무료라 오퍼레이터에 자금을 채울 필요가 없습니다.
CHAIN_ID=${SSAFY_CHAIN_ID}
RPC_URL=${SSAFY_RPC_URL}

TX_SENDER=relayer
SLOW_CHAIN=false

# 유저 지갑을 파생하는 마스터 키.
# 로컬 체인(npm run chain)을 쓸 때는 이 니모닉으로 계정을 만들어 자금을 채웁니다.
MASTER_MNEMONIC="${mnemonic}"
USER_ACCOUNT_PATH="${USER_ACCOUNT_PATH}"

# 트랜잭션을 보내는 지갑입니다. **팀 공용 키를 여기 붙여넣으세요.**
#
# 아래 값은 위 니모닉의 ${OPERATOR_PATH} 에서 파생한 '내' 키입니다.
# 그대로 둬도 체인 조회와 지갑 파생은 됩니다. 하지만 공용 체인에서는
# 배포한 계정이 admin 이라, 팀이 배포한 컨트랙트의 onlyOwner 함수가 막힙니다.
# (/health 가 배포 계정과 지금 오퍼레이터를 비교해 경고합니다)
#
# 주소: ${operator.address}
OPERATOR_PRIVATE_KEY=${operator.privateKey}

INTERNAL_API_KEY=${internalApiKey}
`;
}

function main(): void {
  // npm install 의 postinstall 로도 돌기 때문에, 로컬 개발이 아닌 곳에서는 빠집니다.
  // 운영 컨테이너에 개발용 키가 담긴 .env 가 생기면 진짜 환경변수를 가릴 수 있습니다.
  if (process.env.NODE_ENV === 'production' || process.env.CI) {
    console.log('setup:env 건너뜀 (production / CI)');
    return;
  }

  if (fs.existsSync(ENV_PATH)) {
    console.log('.env 가 이미 있습니다. 건드리지 않습니다.');
    console.log('새로 만들려면 지우고 다시 실행하세요:  rm .env && npm run setup:env');
    return;
  }

  fs.writeFileSync(ENV_PATH, build(), 'utf8');

  console.log(`.env 를 만들었습니다 → ${ENV_PATH}`);
  console.log('니모닉·오퍼레이터 키·내부 API 키를 무작위로 생성했습니다.');
  console.log(`체인: SSAFY (chainId ${SSAFY_CHAIN_ID}) — ${SSAFY_RPC_URL}`);
  console.log('');
  console.log('가스가 무료인 체인이라 오퍼레이터에 자금을 채우지 않아도 됩니다.');
  console.log('');
  console.log('할 일: OPERATOR_PRIVATE_KEY 를 팀 공용 키로 바꾸세요.');
  console.log('      지금은 개인 키가 들어 있어 팀이 배포한 컨트랙트의');
  console.log('      admin 함수를 호출할 수 없습니다. (README 3장)');
}

main();
