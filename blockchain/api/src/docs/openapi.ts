import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { env } from '../config';
import { createWalletBody } from '../controllers/wallet.controller';
import type { HealthReport } from '../services/health.service';
import type { WalletResult } from '../services/wallet.service';
import type { TxReport } from '../services/tx.service';
import { txParams } from '../controllers/tx.controller';
import { balanceQuery, burnBody, mintBody } from '../controllers/catMoney.controller';
import type { BalanceResult, WriteResult } from '../services/catMoney.service';
import { registerPlannedPaths } from './planned';

// `.openapi()` 를 쓰려면 zod 를 먼저 확장해야 합니다. 스키마 정의보다 앞서야 합니다.
extendZodWithOpenApi(z);

/**
 * OpenAPI 문서.
 *
 * **구현된 엔드포인트만 적습니다.** 명세서에 있고 코드에 없는 것은 넣지 않습니다 —
 * Swagger 에 보이면 눌러보고 404 를 받습니다. 기능이 붙을 때 여기에 한 덩어리씩 추가합니다.
 *
 * 요청 스키마는 컨트롤러가 **검증에 쓰는 zod 객체 그 자체**입니다. 따로 베끼지 않으므로
 * 검증과 문서가 어긋날 수 없습니다.
 * 응답은 zod 로 한 번 더 적지만, 아래 `Exact<>` 가 실제 타입과 대조해 컴파일 단계에서 막습니다.
 */

/**
 * 응답 문서가 실제 응답 타입과 어긋나면 **컴파일을 깨뜨리는** 장치.
 *
 * 주의: `never` 로 두면 안 됩니다. 타입 별칭이 `never` 가 되는 것 자체는 에러가 아니고,
 *       `never extends true` 도 참이라 제약으로도 안 걸립니다. 조용히 통과하는
 *       가드는 없는 것보다 나쁩니다 — 그래서 `false` 를 거쳐 제약으로 막습니다.
 */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

const registry = new OpenAPIRegistry();

const internalKey = registry.registerComponent('securitySchemes', 'internalKey', {
  type: 'apiKey',
  in: 'header',
  name: 'x-internal-key',
  description:
    'Spring ↔ 이 서비스 사이의 S2S 인증. 값은 `.env` 의 `INTERNAL_API_KEY` 입니다.\n\n' +
    '이 프로세스는 오퍼레이터 개인키와 마스터 니모닉을 쥐고 있습니다. ' +
    '브라우저에서 직접 닿는 경로가 하나라도 있으면 안 됩니다. (DESIGN.md 1장)',
});

/* ── 공통 ──────────────────────────────────────────────────────── */

const errorResponse = registry.register(
  'Error',
  z
    .object({
      code: z.string().openapi({ example: 'UNAUTHORIZED' }),
      message: z.string().openapi({ example: '내부 인증에 실패했습니다' }),
      detail: z.unknown().optional().openapi({ description: '검증 실패 상세 등. 없을 수 있습니다' }),
    })
    .openapi({ description: '체인의 revert 도 500 이 아니라 이 형태로 내려갑니다 (DESIGN.md 7장)' }),
);

/* ── /health ───────────────────────────────────────────────────── */

const healthResponse = registry.register(
  'HealthReport',
  z.object({
    status: z.enum(['ok', 'degraded']).openapi({
      description: '`warnings` 가 하나라도 있으면 `degraded` 입니다',
    }),
    txSender: z.string().openapi({ example: 'relayer' }),
    chain: z.object({
      connected: z.boolean(),
      expectedChainId: z.number().int().openapi({ example: 31221, description: '`.env` 의 CHAIN_ID' }),
      actualChainId: z.number().int().nullable().openapi({ example: 31221, description: '실제 체인' }),
      blockNumber: z.number().int().nullable().openapi({ example: 11170412 }),
      network: z.string().openapi({ example: 'ssafy' }),
      error: z.string().optional(),
    }),
    operator: z.object({
      address: z.string().openapi({ example: '0xaeac79d81a407731ab8c43a8d5f5c3470e4089ee' }),
      balanceEth: z.string().nullable().openapi({ example: '0.0' }),
      gasIsFree: z.boolean().nullable().openapi({
        description:
          'SSAFY 체인은 가스가 무료라 `true` 입니다. 이때 잔고 0 은 정상이고 경고하지 않습니다.',
      }),
    }),
    contracts: z.record(z.string()).openapi({
      description: '배포된 컨트랙트 이름 → 주소. 배포 전이면 비어 있습니다',
      example: {},
    }),
    warnings: z.array(z.string()).openapi({ example: [] }),
  }),
);

// 응답 타입이 바뀌었는데 문서를 안 고치면 여기서 컴파일이 깨집니다.
type _HealthMatches = Assert<Exact<z.infer<typeof healthResponse>, HealthReport>>;

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['상태'],
  summary: '체인 연결·오퍼레이터·배포 상태',
  description:
    '인증이 필요 없습니다.\n\n' +
    '체인이 끊겨도 **200** 으로 내려가고 상태는 본문에 담깁니다. ' +
    '오케스트레이터가 재시작해도 체인이 살아나지는 않기 때문입니다.\n\n' +
    '`status: "ok"` 에 `warnings` 가 비어 있으면 정상입니다.',
  responses: {
    200: {
      description: '프로세스는 살아 있습니다. 체인 상태는 본문을 보세요',
      content: { 'application/json': { schema: healthResponse } },
    },
  },
});

/* ── /internal/wallets ─────────────────────────────────────────── */

const seedResponse = registry
  .register(
    'WalletSeed',
    z.object({
      status: z.enum(['PENDING', 'ALREADY_DONE']).openapi({
        description:
          '`PENDING` 방금 발행 트랜잭션을 보냈습니다. `ALREADY_DONE` 이미 발행돼 있어 ' +
          '새 트랜잭션을 보내지 않았습니다 — 재시도가 안전한 이유입니다.',
      }),
      amount: z.string().openapi({ example: '1500' }),
      txHash: z
        .string()
        .nullable()
        .openapi({ description: '`ALREADY_DONE` 이면 보낸 트랜잭션이 없어 null 입니다' }),
    }),
  )
  .openapi({ description: '가입 시드 발행 결과' });

const walletResponse = registry.register(
  'Wallet',
  z.object({
    address: z.string().openapi({ example: '0x82b00adc4bb58753d25b860204f378065172a950' }),
    derivationIndex: z.number().int().openapi({ example: 42 }),
    path: z.string().openapi({ example: "m/44'/60'/1'/0/42" }),
    type: z.literal('RELAYER_EOA').openapi({
      description: '릴레이어 단계에서는 EOA 입니다 (DESIGN.md 5-3)',
    }),
    seed: seedResponse.nullable().openapi({
      description: '`seedAmount` 를 보내지 않았으면 null 입니다',
    }),
  }),
);

type _WalletMatches = Assert<Exact<z.infer<typeof walletResponse>, WalletResult>>;

const createWalletRequest = registry.register('CreateWalletRequest', createWalletBody);

registry.registerPath({
  method: 'post',
  path: '/internal/wallets',
  tags: ['회원'],
  summary: '회원 지갑 주소 생성',
  description:
    '파생 인덱스로 유저 지갑 주소를 **계산**합니다.\n\n' +
    '**저장하지 않습니다.** 결과를 DB 에 넣는 건 Spring 입니다. ' +
    '같은 인덱스로 몇 번을 불러도 같은 주소가 나오므로 재시도가 안전합니다.\n\n' +
    '개인키는 어디에도 저장되지 않습니다. 니모닉과 인덱스로 매번 다시 파생합니다 (DESIGN.md 5-1).\n\n' +
    '`derivationIndex` 는 Spring 이 auto-increment 로 발급하고 **절대 재사용하지 않습니다.** ' +
    '재사용하면 다른 사람에게 이전 유저의 주소가 배정되고 남아 있던 자산까지 딸려 갑니다.',
  security: [{ [internalKey.name]: [] }],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: createWalletRequest } },
    },
  },
  responses: {
    200: {
      description: '주소를 계산했습니다. 새로 보낸 트랜잭션은 없습니다',
      content: { 'application/json': { schema: walletResponse } },
    },
    202: {
      description: '주소를 계산하고 시드 발행을 전송했습니다. 확정은 아직입니다',
      content: { 'application/json': { schema: walletResponse } },
    },
    400: {
      description: '`derivationIndex` 범위(0 ~ 2^31-1) 또는 `seedAmount` 형식 오류',
      content: { 'application/json': { schema: errorResponse } },
    },
    401: {
      description: '`x-internal-key` 가 없거나 틀립니다',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description:
        'CatMoney 가 아직 배포되지 않았습니다 (`CONTRACT_UNAVAILABLE`). ' +
        '배포 전까지는 `seedAmount` 를 빼고 호출하세요',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

/* ── /internal/tokens/catmoney ─────────────────────────────────── */

const balanceResponse = registry.register(
  'CatMoneyBalance',
  z.object({
    address: z.string().openapi({ example: '0x82b00adc4bb58753d25b860204f378065172a950' }),
    balance: z.string().openapi({ example: '1200', description: '정수 문자열' }),
    decimals: z.literal(0),
    symbol: z.literal('TCAT'),
  }),
);

type _BalanceMatches = Assert<Exact<z.infer<typeof balanceResponse>, BalanceResult>>;

const writeResponse = registry.register(
  'CatMoneyWriteResult',
  z.object({
    status: z.enum(['PENDING', 'ALREADY_DONE']).openapi({
      description:
        '`PENDING` 방금 전송했습니다. `ALREADY_DONE` 같은 operationKey 가 이미 처리돼 ' +
        '새 트랜잭션을 보내지 않았습니다 — 재시도가 안전한 이유입니다.',
    }),
    txHash: z
      .string()
      .nullable()
      .openapi({ description: '`ALREADY_DONE` 이면 보낸 트랜잭션이 없어 null 입니다' }),
  }),
);

type _WriteMatches = Assert<Exact<z.infer<typeof writeResponse>, WriteResult>>;

registry.registerPath({
  method: 'get',
  path: '/internal/tokens/catmoney/balance',
  tags: ['캣머니'],
  summary: '캣머니 잔액 조회',
  description:
    '**온체인 잔액을 결제 판정 근거로 쓰지 마세요.** Spring 이 확정하고 체인은 결과를 ' +
    '기록합니다 (DESIGN.md 6장). 화면 표시나 대사(reconciliation)에 씁니다.',
  security: [{ [internalKey.name]: [] }],
  request: { query: registry.register('CatMoneyBalanceQuery', balanceQuery) },
  responses: {
    200: { description: '잔액', content: { 'application/json': { schema: balanceResponse } } },
    400: {
      description: '`address` 형식 오류',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description: 'CatMoney 미배포 (`CONTRACT_UNAVAILABLE`)',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/internal/tokens/catmoney/mint',
  tags: ['캣머니'],
  summary: '캣머니 발행',
  description:
    '캣머니를 **새로 만들어** 유저에게 넣습니다.\n\n' +
    '| `reason` | 언제 |\n' +
    '|---|---|\n' +
    '| `DEPOSIT` | 원화 입금이 Spring 에서 확인됐을 때 (환전 — 사는 쪽) |\n' +
    '| `REWARD` | 이벤트·보상 지급 |\n' +
    '| `REFUND` | 예매 취소로 결제한 캣머니를 돌려줄 때 |\n\n' +
    '**가입 시드는 여기가 아닙니다.** `POST /internal/wallets` 의 `seedAmount` 로 ' +
    '지갑 생성과 함께 나갑니다.\n\n' +
    '수량과 지급 정책은 Spring 이 확정합니다. 이 서비스는 판단하지 않고 실행만 합니다.\n\n' +
    '같은 `operationKey` 가 다시 오면 `200` + `ALREADY_DONE` 입니다. 재시도가 안전합니다.',
  security: [{ [internalKey.name]: [] }],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: registry.register('CatMoneyMintRequest', mintBody) } },
    },
  },
  responses: {
    202: {
      description: '전송했습니다. 확정은 `GET /internal/tx/{txHash}`',
      content: { 'application/json': { schema: writeResponse } },
    },
    200: {
      description: '이미 처리된 `operationKey` 입니다. 새 트랜잭션을 보내지 않았습니다',
      content: { 'application/json': { schema: writeResponse } },
    },
    400: { description: '본문 형식 오류', content: { 'application/json': { schema: errorResponse } } },
    503: {
      description: 'CatMoney 미배포',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/internal/tokens/catmoney/burn',
  tags: ['캣머니'],
  summary: '캣머니 소각',
  description:
    '유저 잔액에서 캣머니를 **없앱니다.** 트레저리로 옮기지 않습니다.\n\n' +
    '| `reason` | 언제 |\n' +
    '|---|---|\n' +
    '| `PAYMENT` | 티켓 결제. 캣머니는 포인트처럼 **일부만** 낼 수 있습니다 |\n' +
    '| `WITHDRAWAL` | 원화 출금이 Spring 에서 확인됐을 때 (환전 — 파는 쪽) |\n\n' +
    '서버가 `derivationIndex` 로 유저 키를 파생해 서명하므로, 온체인에는 ' +
    '**유저 본인이 태운 것**으로 남습니다. 남의 잔액을 태우는 함수는 컨트랙트에 없습니다.\n' +
    '`derivationIndex` 로 만든 주소가 `from` 과 다르면 `400` 입니다.\n\n' +
    '### 원화 출금(`WITHDRAWAL`)은 되돌릴 준비를 하고 부르세요\n\n' +
    '토큰을 먼저 태우면 원화 지급 실패 시 유저만 손해이고, 원화를 먼저 주면 ' +
    '소각 실패 시 유저가 둘 다 갖습니다.\n\n' +
    '**소각 확정 → 원화 지급 → 실패하면 별도 `operationKey` 로 `mint` 하여 복구** ' +
    '순서로 가세요. Spring 이 이 상태 전이를 소유합니다. 소각도 복구도 멱등입니다.',
  security: [{ [internalKey.name]: [] }],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: registry.register('CatMoneyBurnRequest', burnBody) } },
    },
  },
  responses: {
    202: {
      description: '전송했습니다. 확정은 `GET /internal/tx/{txHash}`',
      content: { 'application/json': { schema: writeResponse } },
    },
    200: {
      description: '이미 처리된 `operationKey` 입니다',
      content: { 'application/json': { schema: writeResponse } },
    },
    400: {
      description: '본문 형식 오류, 또는 `derivationIndex` 로 만든 주소가 `from` 과 다름',
      content: { 'application/json': { schema: errorResponse } },
    },
    422: {
      description: '잔액 부족 (`INSUFFICIENT_BALANCE`)',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description: 'CatMoney 미배포',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

/* ── /internal/tx/{txHash} ─────────────────────────────────────── */

const txResponse = registry.register(
  'TxReport',
  z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'FAILED']).openapi({
      description:
        '`PENDING` 아직 블록에 안 실림 · `CONFIRMED` 성공 · `FAILED` 실렸지만 컨트랙트가 거부',
    }),
    txHash: z.string(),
    blockNumber: z.number().int().nullable().openapi({ description: 'PENDING 이면 null' }),
    result: z
      .object({
        operation: z
          .enum(['CATMONEY_MINT', 'CATMONEY_BURN', 'CATMONEY_TRANSFER', 'UNKNOWN'])
          .openapi({
            description:
              '영수증 로그로 알아낸 작업. 우리 컨트랙트가 아니면 `UNKNOWN` 입니다',
          }),
        tokenId: z
          .string()
          .nullable()
          .openapi({ description: '티켓(M1)이 붙으면 채워집니다. 캣머니는 항상 null' }),
      })
      .nullable()
      .openapi({ description: 'CONFIRMED 일 때만 채워집니다' }),
    error: z
      .object({ code: z.string(), message: z.string() })
      .nullable()
      .openapi({ description: 'FAILED 일 때만 채워집니다' }),
  }),
);

type _TxMatches = Assert<Exact<z.infer<typeof txResponse>, TxReport>>;

const txRequest = registry.register('TxHashParam', txParams);

registry.registerPath({
  method: 'get',
  path: '/internal/tx/{txHash}',
  tags: ['트랜잭션'],
  summary: '트랜잭션 확정 상태 조회',
  description:
    '모든 쓰기 API 의 **최종 성공 여부**를 여기서 확인합니다.\n\n' +
    '쓰기는 블록 확정을 기다리지 않고 `202` + `txHash` 를 돌려줍니다. ' +
    'Spring 은 그 해시를 저장했다가 이 API 로 확정을 확인하고 DB 에 반영합니다. (DESIGN.md 4-2)\n\n' +
    '### `FAILED` 는 서버 장애가 아닙니다\n\n' +
    '체인이 실행을 거부한 것도 **정상적인 조회 결과**라 `200` 으로 내려갑니다. ' +
    'revert 를 500 으로 던지지 않습니다 (DESIGN.md 7장). ' +
    '가능하면 `error.message` 에 revert 사유를 담습니다.\n\n' +
    'SSAFY 체인은 블록이 약 10초입니다. 보내고 바로 조회하면 대개 `PENDING` 입니다.',
  security: [{ [internalKey.name]: [] }],
  request: { params: txRequest },
  responses: {
    200: {
      description: '조회 성공. 확정 여부는 `status` 를 보세요',
      content: { 'application/json': { schema: txResponse } },
    },
    400: {
      description: '`txHash` 가 0x + 64자리 hex 가 아닙니다',
      content: { 'application/json': { schema: errorResponse } },
    },
    401: {
      description: '`x-internal-key` 가 없거나 틀립니다',
      content: { 'application/json': { schema: errorResponse } },
    },
    404: {
      description:
        '체인이 모르는 해시입니다 (`TX_NOT_FOUND`). 드롭됐거나 애초에 없는 해시입니다',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

/* ── 아직 구현되지 않은 것 ─────────────────────────────────────── */

// Spring 팀이 붙일 자리를 미리 볼 수 있게 계약만 적어둡니다.
// 태그와 summary 에 [미구현] 이 붙습니다 — 호출하면 404 입니다.
registerPlannedPaths(registry, internalKey.name);

/* ── 문서 조립 ─────────────────────────────────────────────────── */

export function buildOpenApiDocument(): ReturnType<OpenApiGeneratorV3['generateDocument']> {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: '티캣 블록체인 내부 API',
      version: '0.1.0',
      description:
        'Spring 이 호출하는 내부 API 입니다. **프론트엔드가 직접 호출하지 않습니다.**\n\n' +
        '### 태그에 `(예정)` 이 붙은 것은 아직 만들지 않았습니다\n\n' +
        '계약을 먼저 확정해 Spring 이 병렬로 붙일 수 있게 적어둔 것입니다. ' +
        '**지금 호출하면 404 가 납니다.** 구현되면 `(예정)` 태그에서 빠집니다.\n\n' +
        '### 규칙\n\n' +
        '- 쓰기는 블록 확정을 기다리지 않고 `202` + `txHash` 를 돌려줍니다. ' +
        '확정은 `GET /internal/tx/{txHash}` 로 확인합니다 (DESIGN.md 4-2)\n' +
        '- 모든 쓰기는 Spring 이 만든 `operationKey`/`ticketKey` 로 멱등입니다. ' +
        '재시도해도 두 번 실행되지 않습니다 (DESIGN.md 4-3)\n' +
        '- 캣머니는 트레저리로 모으지 않고 **발행/소각**으로만 움직입니다. ' +
        '`totalSupply` 가 곧 미사용 캣머니 총량입니다\n' +
        '- 얼굴 벡터는 이 서비스로 보내지 않습니다\n' +
        '- 체인: SSAFY (chainId 31221) · 가스 무료 · 블록 약 10초',
    },
    servers: [{ url: `http://localhost:${env.PORT}`, description: '로컬' }],
    tags: [
      { name: '상태', description: '인증 없이 열려 있습니다' },
      { name: '회원', description: '지갑 파생' },
      { name: '캣머니', description: '발행·소각으로만 움직입니다 (트레저리 없음)' },
      { name: '캣머니 (예정)', description: '아직 만들지 않았습니다 — 호출하면 404' },
      { name: '티켓 (예정)', description: '아직 만들지 않았습니다 — 호출하면 404' },
      { name: '트랜잭션', description: '모든 쓰기의 확정 확인' },
    ],
  });
}
