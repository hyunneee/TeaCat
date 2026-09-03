import { provider } from './provider';

/**
 * 트랜잭션 직렬화 + 논스 관리. (DESIGN.md 4-4)
 *
 * 한 주소가 동시에 여러 트랜잭션을 만들면 **같은 논스를 두 번 씁니다.**
 * 나중 것이 앞의 것을 대체하거나 그냥 사라집니다. 요청이 몰리는 순간에 조용히
 * 실패하는 종류라, 보내는 지점을 한 줄로 세웁니다.
 *
 * ── 순서만 세워서는 부족합니다 ────────────────────────────────────
 * ethers v6 는 `eth_getTransactionCount` 응답을 **250ms 동안 캐시**합니다.
 * 전송을 순서대로 해도 그 안에 들어오는 요청들은 같은(낡은) 논스를 받습니다.
 * 그래서 논스를 **직접 세서 명시적으로 넘깁니다.** 체인에는 처음 한 번과
 * 실패했을 때만 물어봅니다.
 *
 * ── 오퍼레이터만이 아닙니다 ──────────────────────────────────────
 * 소각은 **유저 본인이 서명**하므로 유저 주소마다 논스가 따로 돕니다.
 * 같은 유저의 중복 요청(재시도)이 겹치면 똑같은 사고가 납니다 — 실제로
 * 확정 전 중복 소각에서 트랜잭션 하나가 통째로 사라진 적이 있습니다.
 * 그래서 주소별로 논스를 셉니다.
 *
 * 주의: **한 프로세스에서만** 맞습니다. 이 서비스를 여러 개 띄우면 서로가 센 값을
 *       모릅니다. 스케일 아웃할 때는 논스를 외부에서 관리해야 합니다.
 */

/** 마지막으로 예약된 작업. 주소와 무관하게 전부 한 줄로 세웁니다. */
let tail: Promise<unknown> = Promise.resolve();

/** 주소(소문자) → 다음에 쓸 논스. 없으면 체인에서 읽습니다. */
const nextNonce = new Map<string, number>();

/** 해당 주소의 논스를 체인에서 다시 읽게 합니다. (드롭·외부 전송 대응) */
export function resetNonce(address: string): void {
  nextNonce.delete(address.toLowerCase());
}

/**
 * 서명해서 보내는 작업을 순서대로, 논스를 붙여 실행합니다.
 *
 * 큐는 하나입니다. 전송 자체는 확정을 기다리지 않아 빠르므로(수백 ms),
 * 주소별로 큐를 나눠 복잡도를 늘릴 이유가 없습니다.
 *
 * 앞 작업이 실패해도 뒤 작업은 계속 진행됩니다 — 한 번의 revert 로
 * 큐 전체가 멈추면 안 됩니다.
 */
export function sendSerialized<T>(
  address: string,
  send: (nonce: number) => Promise<T>,
): Promise<T> {
  const key = address.toLowerCase();

  async function runTask(): Promise<T> {
    let nonce = nextNonce.get(key);
    if (nonce === undefined) {
      // 'latest' 를 씁니다. 'pending' 은 노드마다 다르게 셉니다.
      nonce = await provider.getTransactionCount(address, 'latest');
    }

    try {
      const result = await send(nonce);
      nextNonce.set(key, nonce + 1);
      return result;
    } catch (error) {
      // 우리가 센 값이 체인과 어긋났을 수 있습니다. 다음 번에 다시 읽습니다.
      nextNonce.delete(key);
      throw error;
    }
  }

  const run = tail.then(runTask, runTask);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
