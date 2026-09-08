import { JsonRpcProvider, Wallet, formatEther } from 'ethers';
import { env } from '../config';

/**
 * 체인 어댑터.
 *
 * 주의: `ethers` 를 import 하는 곳은 `chain/` 안뿐입니다. (DESIGN.md 4-1)
 * `services/` 는 "티켓을 발행한다"만 알고 그게 트랜잭션이라는 건 모릅니다.
 */
export const provider = new JsonRpcProvider(env.RPC_URL, env.CHAIN_ID);

/**
 * 가스를 지불하는 지갑.
 *
 * M1(릴레이어)에서는 이 계정이 모든 트랜잭션을 직접 보냅니다.
 * SSAFY 체인은 가스가 무료라 잔고를 채워둘 필요가 없습니다.
 */
const operatorWallet = new Wallet(env.OPERATOR_PRIVATE_KEY, provider);

/** 오퍼레이터 주소. `Wallet` 객체 자체는 `chain/` 밖으로 내보내지 않습니다. */
export const operatorAddress = operatorWallet.address.toLowerCase();

/** 서명이 필요한 `chain/` 내부 코드만 씁니다. */
export function operatorSigner(): Wallet {
  return operatorWallet;
}

/**
 * **`OPERATOR_ROLE` 을 쥔 지갑.** 위의 발행 지갑과 다릅니다.
 *
 * ── 이름이 헷갈리기 쉬워서 정리해 둡니다 ──────────────────────────
 *
 *   operatorWallet          가스를 내고 트랜잭션을 보내는 릴레이어.
 *                           배포 계정이라 온체인에서는 **`MINTER_ROLE`** 입니다
 *   contractOperatorWallet  컨트랙트의 **`OPERATOR_ROLE`**.
 *                           도안 등록 · 정지 스위치 · 추첨을 서명합니다
 *
 * 배포 스크립트가 `CONTRACT_OPERATOR_ADDRESS` 에 `OPERATOR_ROLE` 을 주므로,
 * `CONTRACT_OPERATOR_PRIVATE_KEY` 는 **그 주소의 키**여야 합니다. 어긋나면
 * 도안 등록과 추첨이 전부 `AccessControlUnauthorizedAccount` 로 실패합니다.
 *
 * 변수를 안 주면 발행 키로 떨어집니다 — 역할을 나누지 않은 개발 환경의 기존
 * 동작 그대로라, 이 변경으로 지금 돌아가는 것이 깨지지 않습니다.
 */
const contractOperatorWallet = env.CONTRACT_OPERATOR_PRIVATE_KEY
  ? new Wallet(env.CONTRACT_OPERATOR_PRIVATE_KEY, provider)
  : operatorWallet;

export const contractOperatorAddress = contractOperatorWallet.address.toLowerCase();

/** 두 키가 실제로 갈려 있는지. `/health` 와 로그가 씁니다. */
export const operatorRoleIsSeparate = contractOperatorAddress !== operatorAddress;

export function contractOperatorSigner(): Wallet {
  return contractOperatorWallet;
}

export interface ChainStatus {
  connected: boolean;
  chainId: number | null;
  blockNumber: number | null;
  /** 실제 체인의 chainId 가 .env 의 CHAIN_ID 와 다르면 true */
  chainIdMismatch: boolean;
  /** gasPrice 가 0 인 체인인지. SSAFY 체인이 여기 해당합니다. null 이면 확인 실패 */
  gasIsFree: boolean | null;
  error?: string;
}

export async function getChainStatus(): Promise<ChainStatus> {
  try {
    /* provider.getNetwork() 을 쓰지 않는 이유:
       생성자에 CHAIN_ID 를 넘겼기 때문에, 실제 체인이 다르면 ethers 는 불일치를
       알려주는 대신 "network changed" 예외를 던집니다. 그러면 /health 가
       "연결 안 됨" 으로만 보여서 진짜 원인(오타 난 CHAIN_ID)이 가려집니다.
       상태 조회만큼은 날것으로 물어봅니다.

       참고: 예외를 던지는 것 자체는 옳은 동작입니다 — 엉뚱한 chainId 로 서명하느니
       모든 트랜잭션이 실패하는 편이 낫습니다. 여기서는 그 이유만 정확히 보여줍니다. */
    const [rawChainId, rawBlockNumber, rawGasPrice] = await Promise.all([
      provider.send('eth_chainId', []) as Promise<string>,
      provider.send('eth_blockNumber', []) as Promise<string>,
      provider.send('eth_gasPrice', []) as Promise<string>,
    ]);

    const chainId = Number(BigInt(rawChainId));

    return {
      connected: true,
      chainId,
      blockNumber: Number(BigInt(rawBlockNumber)),
      chainIdMismatch: chainId !== env.CHAIN_ID,
      gasIsFree: BigInt(rawGasPrice) === 0n,
    };
  } catch (error) {
    return {
      connected: false,
      chainId: null,
      blockNumber: null,
      chainIdMismatch: false,
      gasIsFree: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getOperatorBalanceEth(): Promise<string | null> {
  try {
    return formatEther(await provider.getBalance(operatorAddress));
  } catch {
    return null;
  }
}
