import { operatorAddress, provider } from './provider';

/**
 * 오퍼레이터 트랜잭션 직렬화 + 논스 관리. (DESIGN.md 4-4)
 *
 * 한 서명자가 동시에 여러 트랜잭션을 만들면 **같은 논스를 두 번 씁니다.**
 * 나중 것이 앞의 것을 대체하거나 드롭됩니다. 가입이 몰리는 순간에 조용히
 * 실패하는 종류라, 보내는 지점을 한 줄로 세웁니다.
 *
 * ── 순서만 세워서는 부족합니다 ────────────────────────────────────
 * ethers v6 는 `eth_getTransactionCount` 응답을 **250ms 동안 캐시**합니다.
 * 전송을 순서대로 해도 그 안에 들어오는 요청들은 같은(낡은) 논스를 받아
 * `Nonce too low` 로 죽습니다. 로컬에서 10건을 동시에 넣어 확인한 사고입니다.
 *
 * 그래서 논스를 **직접 세서 명시적으로 넘깁니다.** 체인에는 처음 한 번과
 * 실패했을 때만 물어봅니다.
 *
 * 주의: **한 프로세스에서 한 서명자일 때만** 맞습니다. 이 서비스를 여러 개
 *       띄우면 서로가 센 값을 모릅니다. 스케일 아웃할 때는 오퍼레이터 키를
 *       인스턴스마다 나누거나 논스를 외부에서 관리해야 합니다.
 */

/** 마지막으로 예약된 작업. 성공/실패와 무관하게 다음 작업이 이어붙습니다. */
let tail: Promise<unknown> = Promise.resolve();

/** 다음에 쓸 논스. `null` 이면 체인에서 다시 읽습니다. */
let nextNonce: number | null = null;

/** 다음 전송 때 체인에서 논스를 다시 읽게 합니다. (드롭·재시작 대응) */
export function resetNonce(): void {
  nextNonce = null;
}

/**
 * 오퍼레이터로 서명해 보내는 작업을 순서대로, 논스를 붙여 실행합니다.
 *
 * 앞 작업이 실패해도 뒤 작업은 계속 진행됩니다 — 한 번의 revert 로
 * 큐 전체가 멈추면 안 됩니다.
 */
export function sendSerialized<T>(send: (nonce: number) => Promise<T>): Promise<T> {
  const run = tail.then(runTask, runTask);

  async function runTask(): Promise<T> {
    if (nextNonce === null) {
      // 'latest' 를 씁니다. 'pending' 은 노드마다 다르게 셉니다.
      nextNonce = await provider.getTransactionCount(operatorAddress, 'latest');
    }

    const nonce = nextNonce;
    try {
      const result = await send(nonce);
      nextNonce = nonce + 1;
      return result;
    } catch (error) {
      // 우리가 센 값이 체인과 어긋났을 수 있습니다. 다음 번에 다시 읽습니다.
      nextNonce = null;
      throw error;
    }
  }

  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
