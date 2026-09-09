import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * 지표 정의. Prometheus 가 `/metrics` 를 15초마다 긁어갑니다.
 *
 * ── 왜 여기에 몰아놨나 ────────────────────────────────────────────
 * 지표 이름과 라벨은 **한 번 대시보드·알림에 박히면 바꾸기 어렵습니다.** 이름을 고치는 순간
 * 과거 시계열과 끊기기 때문입니다. 정의를 한 파일에 모아두면 무엇이 있는지 한눈에 보이고,
 * 중복된 이름을 실수로 만들 일도 없습니다 (같은 이름을 두 번 등록하면 prom-client 가 던집니다).
 *
 * ── 라벨에 무엇을 넣으면 안 되는가 ────────────────────────────────
 * 🔴 주소·txHash·ticketKey 를 라벨에 넣지 마십시오. 라벨 값 하나가 시계열 하나라,
 *    유저마다 다른 값을 넣으면 Prometheus 메모리가 그대로 터집니다 (카디널리티 폭발).
 *    "누구의" 트랜잭션인지는 지표가 아니라 **로그**가 답할 몫입니다.
 */
export const registry = new Registry();

/**
 * Node 프로세스 기본 지표 (힙·GC·핸들·이벤트 루프).
 *
 * 🔴 이 중 `nodejs_eventloop_lag_seconds` 가 이 서비스에서는 특히 중요합니다.
 *    논스 큐(chain/nonce.ts)가 단일 이벤트 루프 위에서 모든 전송을 직렬화하므로,
 *    루프가 밀리면 발행 처리량이 그대로 밀립니다.
 */
// prefix 를 주지 않는다. prom-client 의 기본 지표는 이미 nodejs_ / process_ 로 시작하므로
// 접두어를 붙이면 nodejs_nodejs_eventloop_lag_seconds 가 되어, 표준 이름을 기대하는
// 공개 대시보드가 전부 빈 그래프가 된다.
collectDefaultMetrics({ register: registry });

// ── HTTP ────────────────────────────────────────────────────────────

export const httpDuration = new Histogram({
  name: 'teacat_bc_http_request_seconds',
  help: 'Spring 이 부르는 내부 API 의 응답 시간',
  // 🔴 route 는 반드시 **패턴**이어야 합니다 (/internal/tickets/:id).
  //    실제 URL 을 넣으면 티켓 수만큼 시계열이 생깁니다.
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 1, 3, 10],
  registers: [registry],
});

// ── 트랜잭션 큐 (chain/nonce.ts) ─────────────────────────────────────

export const txQueueDepth = new Gauge({
  name: 'teacat_bc_tx_queue_depth',
  help: '전송 대기 중인 트랜잭션 수. 큐가 하나라 이 값이 곧 처리 대기열이다',
  registers: [registry],
});

export const txQueueWait = new Histogram({
  name: 'teacat_bc_tx_queue_wait_seconds',
  help: '큐에 들어가서 실제로 전송이 시작되기까지 기다린 시간',
  buckets: [0.01, 0.1, 0.5, 1, 5, 15, 60],
  registers: [registry],
});

export const txSendDuration = new Histogram({
  name: 'teacat_bc_tx_send_seconds',
  help: '트랜잭션 전송 소요 시간 (확정 대기는 포함하지 않는다)',
  labelNames: ['result'],
  buckets: [0.1, 0.3, 1, 3, 10, 30],
  registers: [registry],
});

/**
 * 논스 재조회. **드리프트의 유일한 신호입니다.**
 *
 * 전송이 실패하면 우리가 센 논스를 버리고 체인에 다시 묻습니다(nonce.ts 의 catch).
 * 평소에는 0 이어야 하고, 이 값이 오르는 동안에는 트랜잭션이 조용히 사라질 수 있습니다.
 */
export const nonceResets = new Counter({
  name: 'teacat_bc_nonce_reset_total',
  help: '논스를 체인에서 다시 읽은 횟수 (전송 실패 후)',
  registers: [registry],
});

// ── 확정 감시 (services/confirm.service.ts) ──────────────────────────

export const confirmDuration = new Histogram({
  name: 'teacat_bc_confirm_seconds',
  help: '전송부터 영수증 확인까지 걸린 시간',
  labelNames: ['kind', 'result'],
  // SSAFY 체인은 블록이 10초라 그 배수 언저리에 버킷을 둔다
  buckets: [5, 10, 20, 30, 60, 120, 300],
  registers: [registry],
});

export const txDropped = new Counter({
  name: 'teacat_bc_tx_dropped_total',
  help: '체인이 끝내 모르는 채로 남아 드롭 판정된 트랜잭션 수',
  labelNames: ['kind'],
  registers: [registry],
});

export const watchingCount = new Gauge({
  name: 'teacat_bc_watching_count',
  help: '영수증을 기다리며 메모리에 들고 있는 트랜잭션 수 (재시작하면 0 으로 리셋된다)',
  labelNames: ['kind'],
  registers: [registry],
});

export const sweepProcessed = new Counter({
  name: 'teacat_bc_sweep_processed_total',
  help: '훑기가 처리한 행 수. 이 값이 오른다는 건 추적이 놓친 것을 주워담았다는 뜻이다',
  labelNames: ['kind'],
  registers: [registry],
});

// ── 체인 (chain/provider.ts) ─────────────────────────────────────────

export const rpcDuration = new Histogram({
  name: 'teacat_bc_rpc_seconds',
  help: 'SSAFY 체인 RPC 호출 시간',
  labelNames: ['method', 'result'],
  buckets: [0.05, 0.2, 0.5, 1, 3, 10],
  registers: [registry],
});

/**
 * 마지막으로 확인한 블록 번호.
 *
 * 값 자체보다 **증가하는지**가 중요합니다. 멈춰 있으면 체인이 죽었거나 RPC 가 옛 노드를
 * 보고 있는 것이고, 그 동안 보낸 트랜잭션은 전부 확정되지 않습니다.
 */
export const chainBlockNumber = new Gauge({
  name: 'teacat_bc_chain_block_number',
  help: '마지막으로 관측한 블록 번호',
  registers: [registry],
});

export const chainUp = new Gauge({
  name: 'teacat_bc_chain_up',
  help: '체인 RPC 연결 상태 (1 정상 / 0 두절)',
  registers: [registry],
});
