import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { env } from '../config';
import { createWalletBody } from '../controllers/wallet.controller';
import type { HealthReport } from '../services/health.service';
import type { WalletResult } from '../services/wallet.service';
import type { TxReport } from '../services/tx.service';
import { txParams } from '../controllers/tx.controller';
import {
  balanceQuery,
  burnBody,
  mintBody,
  transferBody,
} from '../controllers/catMoney.controller';
import type { BalanceResult, WriteResult } from '../services/catMoney.service';
import { issueBody, ticketKeyQuery, ticketParams } from '../controllers/ticket.controller';
import {
  balanceQuery as photocardBalanceQuery,
  designBody,
  issueBody as photocardIssueBody,
  photocardKeyQuery,
  transferBody as photocardTransferBody,
} from '../controllers/photocard.controller';
import { assignBody, drawParams, openBody } from '../controllers/draw.controller';
import type {
  DesignRegisterResult,
  IssueBatchResult,
  PhotocardBalanceResult,
  PhotocardLookupResult,
  PhotocardTransferResult,
} from '../services/photocard.service';
import type {
  DrawAssignResult,
  DrawOpenResult,
  DrawRevealResult,
  DrawStateResult,
} from '../services/draw.service';
import type {
  BurnResult,
  IssueResult,
  TicketLookupResult,
  TicketResult,
} from '../services/ticket.service';

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

/* 실제로 파생되는 모양의 소문자 주소입니다.
   예시를 안 주면 Swagger 가 정규식만 보고 주소를 만들어내는데, 그 값은 EIP-55
   체크섬이 안 맞습니다. 그걸 그대로 눌러서 500 을 받은 적이 있습니다. */
const ADDRESS_EXAMPLE = '0x5cd64f0ff93576e04ef21e81dfd8c24f54938c0a';

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
    db: z
      .object({
        enabled: z.boolean().openapi({
          description: '`DATABASE_URL` 이 설정돼 있는지. false 면 티켓이 계속 PENDING 입니다',
        }),
        connected: z.boolean(),
      })
      .openapi({
        description:
          'Spring DB 연결 상태. 확정 결과를 여기에 기록합니다 (DESIGN.md 1장 예외)',
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
  request: {
    query: registry.register(
      'CatMoneyBalanceQuery',
      balanceQuery.openapi({ example: { address: ADDRESS_EXAMPLE } }),
    ),
  },
  responses: {
    200: { description: '잔액', content: { 'application/json': { schema: balanceResponse } } },
    400: {
      description: '`address` 형식 오류 또는 EIP-55 체크섬 불일치 (`INVALID_ADDRESS`)',
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
    '### ⚠️ `to` 는 반드시 우리가 파생한 유저 지갑이어야 합니다\n\n' +
    '`POST /internal/wallets` 가 돌려준 주소만 넣으세요. ' +
    '**개인 MetaMask 같은 외부 주소에 발행하면 그 캣머니는 영원히 회수할 수 없습니다.**\n\n' +
    '소각(`burn`)은 유저 본인의 서명이 필요한데, 서버는 니모닉에서 파생한 지갑의 키만 ' +
    '가지고 있습니다. 외부 지갑의 키는 모르고, 컨트랙트에 `burnFrom` 도 없어서 ' +
    'admin 이라도 남의 잔액은 태울 수 없습니다. 즉 **결제에 쓸 수 없는 캣머니**가 됩니다.\n\n' +
    '이 서비스는 `to` 가 파생 지갑인지 검사하지 못합니다 — 인덱스를 전부 훑어볼 수 없기 ' +
    '때문입니다. **Spring 이 자기 DB 의 지갑 주소만 넣어주셔야 합니다.**\n\n' +
    '수량과 지급 정책은 Spring 이 확정합니다. 이 서비스는 판단하지 않고 실행만 합니다.\n\n' +
    '같은 `operationKey` 가 다시 오면 `200` + `ALREADY_DONE` 입니다. 재시도가 안전합니다.\n\n' +
    '주의: `operationKey` 는 **Spring 이 만드는 식별자**입니다. 비밀값을 넣지 마세요 — ' +
    '해싱된 값이 온체인에 영구히 기록됩니다.',
  security: [{ [internalKey.name]: [] }],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: registry.register(
            'CatMoneyMintRequest',
            mintBody.openapi({
              example: {
                operationKey: 'catmoney_deposit_20260904_00001',
                to: ADDRESS_EXAMPLE,
                amount: '500',
                reason: 'DEPOSIT',
              },
            }),
          ),
        },
      },
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
      description:
        '본문 형식 오류, `to` 의 EIP-55 체크섬 불일치(`INVALID_ADDRESS`), ' +
        '또는 `derivationIndex` 로 만든 주소가 `from` 과 다름',
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

registry.registerPath({
  method: 'post',
  path: '/internal/tokens/catmoney/transfer',
  tags: ['캣머니'],
  summary: '캣머니 전송 (포카 마켓 정산)',
  description:
    '유저 → 유저로 캣머니를 옮깁니다. 포카 마켓에서 **구매자가 판매자에게 낼 때** 씁니다.\n\n' +
    '**발행도 소각도 아닙니다.** `totalSupply` 는 그대로고 소유자만 바뀝니다 — ' +
    '그래서 이 값이 여전히 미사용 캣머니 총량입니다.\n\n' +
    '컨트랙트의 `transferWithKey` 를 부릅니다. 표준 `transfer` 를 쓰지 않는 이유는 ' +
    '거기엔 `operationKey` 를 걸 자리가 없어서입니다 — 응답을 못 받고 재시도하면 ' +
    '**구매자가 두 번 냅니다.**\n\n' +
    '서버가 `derivationIndex` 로 보내는 유저의 키를 파생해 서명합니다. ' +
    '계산한 주소가 `from` 과 다르면 `400` 입니다. `from` 과 `to` 가 같아도 `400` 입니다 — ' +
    '컨트랙트는 통과시키지만 **키만 태우고 아무것도 옮기지 않아** 그 거래를 다시 시도할 ' +
    '수 없게 됩니다.\n\n' +
    '같은 `operationKey` 가 다시 오면 `200` + `ALREADY_DONE` 입니다. 재시도가 안전합니다.\n\n' +
    '### ⚠️ 이 API 는 돈만 옮깁니다\n\n' +
    'NFT 소유권 이전(`POST /internal/photocards/transfer`)은 **별개의 트랜잭션**이고 ' +
    '둘은 원자적이지 않습니다. 한쪽만 성공할 수 있습니다.\n\n' +
    '```\n' +
    '① 캣머니 전송 (구매자 → 판매자)   ← 여기. 확정까지 기다리세요\n' +
    '② 카드 이전   (판매자 → 구매자)\n' +
    '   실패하면 → 캣머니를 되돌립니다 (판매자 → 구매자, 별도 operationKey 로)\n' +
    '```\n\n' +
    '**이 순서와 보상은 Spring 이 소유합니다.** 되돌릴 수 있는 쪽을 나중에 두는 것이 ' +
    '이유입니다 — 카드가 먼저 넘어가면 구매자가 그 사이 되팔았을 때 방법이 없습니다.',
  security: [{ [internalKey.name]: [] }],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: registry.register(
            'CatMoneyTransferRequest',
            transferBody.openapi({
              example: {
                operationKey: 'poca_trade_20260908_00001',
                from: ADDRESS_EXAMPLE,
                derivationIndex: 42,
                to: '0x82b00adc4bb58753d25b860204f378065172a950',
                amount: '3000',
                tradeId: 'trade_00001',
              },
            }),
          ),
        },
      },
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
    400: {
      description:
        '본문 형식 오류, `to` 의 EIP-55 체크섬 불일치(`INVALID_ADDRESS`), ' +
        '`derivationIndex` 로 만든 주소가 `from` 과 다름, 또는 `from` 과 `to` 가 같음',
      content: { 'application/json': { schema: errorResponse } },
    },
    422: {
      description: '보내는 유저의 잔액 부족 (`INSUFFICIENT_BALANCE`)',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description: 'CatMoney 미배포, 또는 정지 스위치가 켜져 있음 (`CONTRACT_PAUSED`)',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

/* ── /internal/tickets ─────────────────────────────────────────── */

/* 온체인에 있는 것은 tokenId 와 owner 뿐입니다. 그리고 tokenId 는 순번이 아니라
   `uint256(keccak256(ticketKey))` 라, ticketKey 자체가 번호 안에 들어 있습니다.
   좌석·공연·입장 여부는 Spring 의 티켓 DB 가 소유합니다. */

const TOKEN_ID_EXAMPLE =
  '68305854838909086441253217158707152467914205174056545964033358727224496790241';

const ticketResponse = registry.register(
  'Ticket',
  z.object({
    tokenId: z.string().openapi({ example: TOKEN_ID_EXAMPLE }),
    owner: z
      .string()
      .nullable()
      .openapi({
        example: '0x82b00adc4bb58753d25b860204f378065172a950',
        description: '**소각(예매 취소)됐으면 null** 입니다',
      }),
    burned: z.boolean().openapi({ description: '취소되어 소각됐는지. `owner === null` 과 같습니다' }),
  }),
);

type _TicketMatches = Assert<Exact<z.infer<typeof ticketResponse>, TicketResult>>;

const ticketLookupResponse = registry.register(
  'TicketLookup',
  z.object({
    issued: z.boolean().openapi({
      description: '이 `ticketKey` 로 발행된 적이 있는지. **false 면 나머지 필드는 의미가 없습니다**',
    }),
    tokenId: z.string().nullable().openapi({ example: TOKEN_ID_EXAMPLE }),
    owner: z.string().nullable().openapi({ description: '소각됐으면 null' }),
    burned: z.boolean(),
  }),
);

type _TicketLookupMatches = Assert<Exact<z.infer<typeof ticketLookupResponse>, TicketLookupResult>>;

const issueResponse = registry.register(
  'TicketIssueResult',
  z.object({
    status: z.enum(['PENDING', 'ALREADY_ISSUED']).openapi({
      description:
        '`PENDING` 방금 전송했습니다. `ALREADY_ISSUED` 같은 `ticketKey` 가 이미 발행돼 ' +
        '새 트랜잭션을 보내지 않았습니다 — 재시도가 안전한 이유입니다.',
    }),
    txHash: z
      .string()
      .nullable()
      .openapi({ description: '`ALREADY_ISSUED` 면 보낸 트랜잭션이 없어 null 입니다' }),
    tokenId: z.string().openapi({
      example: TOKEN_ID_EXAMPLE,
      description:
        '`ticketKey` 에서 계산한 번호라 **두 응답 모두 채워집니다.** 발행 전에도 정해집니다.\n\n' +
        '⚠️ `PENDING` 이면 이 번호는 **아직 체인에 없습니다.** 그 티켓이 갖게 될 번호일 뿐이라, ' +
        '발행이 실패하면 그런 토큰은 생기지 않습니다. 입장 판정 전에 ' +
        '`GET /internal/tx/{txHash}` 로 확정을 확인하세요.',
    }),
  }),
);

type _IssueMatches = Assert<Exact<z.infer<typeof issueResponse>, IssueResult>>;

const burnResponse = registry.register(
  'TicketBurnResult',
  z.object({
    status: z.enum(['PENDING', 'ALREADY_DONE']).openapi({
      description: '`ALREADY_DONE` 이미 소각된 티켓입니다. 새 트랜잭션을 보내지 않았습니다',
    }),
    txHash: z.string().nullable(),
    tokenId: z.string().openapi({ example: TOKEN_ID_EXAMPLE }),
  }),
);

type _BurnMatches = Assert<Exact<z.infer<typeof burnResponse>, BurnResult>>;

const TICKET_PENDING =
  '블록 확정을 기다리지 않고 즉시 돌려줍니다. Spring 은 `txHash` 를 저장하고 ' +
  '`GET /internal/tx/{txHash}` 로 확정을 확인합니다. (DESIGN.md 4-2)';

registry.registerPath({
  method: 'post',
  path: '/internal/tickets/issue',
  tags: ['티켓'],
  summary: '티켓 SBT 발행',
  description:
    '**결제가 완료된 뒤** 부릅니다. 티켓은 발행되는 순간부터 양도할 수 없습니다.\n\n' +
    '### 온체인에는 두 가지만 올라갑니다\n\n' +
    '`tokenId` 와 `owner`. **좌석·공연·입장 여부는 보내지 마세요** — ' +
    '그건 Spring 의 티켓 DB 가 소유합니다. 같은 값을 체인에 또 두면 두 벌이 되고, ' +
    '어긋나는 순간 어느 쪽이 맞는지 판단할 근거가 사라집니다.\n' +
    '**얼굴 벡터는 이 서비스로 보내지 마세요.**\n\n' +
    '### `ticketKey` 가 티켓 두 장을 막습니다\n\n' +
    '이 서비스에는 DB 가 없습니다. tx 를 보낸 직후 응답 전에 프로세스가 죽으면 ' +
    'Spring 은 실패로 보고 재시도하는데, 그때 중복 발행을 막을 수 있는 건 체인뿐입니다 — ' +
    '"tx 가 나갔는지" 는 보낸 쪽만 아는데 그 쪽이 죽었기 때문입니다. (DESIGN.md 4-3)\n\n' +
    '같은 `ticketKey` 로 재시도하면 `200` + `ALREADY_ISSUED` 에 기존 `tokenId` 가 담겨 옵니다.\n\n' +
    '### 캣머니 결제와의 순서\n\n' +
    '**캣머니 소각(결제)을 먼저 확정하고, 그 다음 발행하세요.**\n\n' +
    '발행이 실패하면 별도 `operationKey` 로 `mint`(`reason: REFUND`) 해서 되돌립니다 — ' +
    '환급 경로는 발행이 정지된 중에도 살아 있어 항상 복구됩니다.\n\n' +
    '### tokenId 는 즉시 나옵니다. 다만 아직 체인에는 없습니다\n\n' +
    '`tokenId = uint256(keccak256(ticketKey))` 라 트랜잭션을 보내기 전에 정해집니다. ' +
    '그래서 확정을 기다리지 않고도 응답에 담아 드립니다 — DB 에 미리 기록하셔도 됩니다.\n\n' +
    '**다만 번호를 받았다고 티켓이 있는 건 아닙니다.** 발행이 실패하면(정지 중이거나 ' +
    'tx 가 드롭되면) 그런 토큰은 생기지 않습니다. **입장 판정 전에는** ' +
    '`GET /internal/tx/{txHash}` 로 `CONFIRMED` 를 확인하세요.\n\n' +
    '77자리 숫자입니다. `BIGINT` 에 안 들어가니 `VARCHAR(78)` 이나 `NUMERIC(78,0)` 을 쓰세요.\n\n' +
    '응답을 아예 잃어버렸다면 `GET /internal/tickets/by-key` 로 찾으세요.\n\n' +
    '주의: `to` 는 **`POST /internal/wallets` 가 만들어준 파생 지갑**이어야 합니다. ' +
    '티켓은 양도할 수 없어서, 엉뚱한 주소로 나가면 옮길 방법이 아예 없습니다.\n\n' +
    TICKET_PENDING,
  security: [{ [internalKey.name]: [] }],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: registry.register(
            'TicketIssueRequest',
            issueBody.openapi({
              example: { ticketKey: '42', to: ADDRESS_EXAMPLE },
            }),
          ),
        },
      },
    },
  },
  responses: {
    202: {
      description: '전송했습니다. 확정은 `GET /internal/tx/{txHash}`',
      content: { 'application/json': { schema: issueResponse } },
    },
    200: {
      description:
        '이미 발행된 `ticketKey` 입니다. 새 트랜잭션을 보내지 않았습니다. ' +
        '**취소(소각)된 예매도 여기 해당합니다** — 그 키는 이미 소비됐습니다',
      content: { 'application/json': { schema: issueResponse } },
    },
    400: {
      description:
        '본문 형식 오류, 또는 `to` 의 EIP-55 체크섬이 틀립니다 (`INVALID_ADDRESS`). ' +
        '대소문자를 섞어 보내려면 체크섬이 맞아야 하고, **전부 소문자로 보내면 항상 안전합니다**',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description:
        'TicketSBT 미배포(`CONTRACT_UNAVAILABLE`), 또는 운영자가 발행을 정지시켰습니다 ' +
        '(`CONTRACT_PAUSED`)',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/internal/tickets/by-key',
  tags: ['티켓'],
  summary: 'ticketKey 로 발행 결과 조회',
  description:
    '발행 요청을 보냈는데 **응답을 못 받았을 때 결과를 복구**하는 용도입니다.\n\n' +
    '이게 없으면 남는 선택지가 "재시도해서 두 장 발행되거나, 재시도 안 해서 결제만 되고 ' +
    '티켓이 없거나" 뿐입니다 — 온체인의 `tokenId`·`owner` 만으로는 같은 지갑의 여러 티켓 중 ' +
    '어느 것이 어느 예매 건인지 구분되지 않습니다.\n\n' +
    '발행되지 않았어도 `200` 에 `{ "issued": false }` 로 내려갑니다. 404 가 아닙니다 — ' +
    '404 로 만들면 "아직 안 됨" 과 "경로가 틀림" 을 구분할 수 없습니다.\n\n' +
    '취소(소각)된 티켓도 `issued: true` 이고 `burned: true` 입니다.\n\n' +
    '### ⚠️ `tokenId` 를 넣지 마세요\n\n' +
    '여기는 발행할 때 보낸 **`ticketKey` 원본 문자열**을 받습니다 (예: `42`). ' +
    '`tokenId` 는 그 키를 해싱한 **결과**라, 그 숫자를 다시 넣으면 서버가 그걸 또 해싱해서 ' +
    '엉뚱한 자리를 찾고 `issued: false` 를 돌려줍니다. 오류가 아니라 정상 응답이라 ' +
    '더 헷갈립니다 — 실제로 한 번 밟았습니다.\n\n' +
    '| 가진 값 | 쓸 곳 |\n' +
    '|---|---|\n' +
    '| `ticketKey` (`42`) | `GET /internal/tickets/by-key?key=42` |\n' +
    '| `tokenId` (77자리) | `GET /internal/tickets/{tokenId}` |\n\n' +
    '`ticketKey` 는 자유 문자열이므로 **URL 인코딩해서** 보내세요.',
  security: [{ [internalKey.name]: [] }],
  request: {
    query: registry.register(
      'TicketKeyQuery',
      ticketKeyQuery.openapi({ example: { key: '42' } }),
    ),
  },
  responses: {
    200: {
      description: '발행 여부. 발행됐으면 tokenId·owner·burned 가 함께 옵니다',
      content: { 'application/json': { schema: ticketLookupResponse } },
    },
    400: { description: '`key` 가 비었습니다', content: { 'application/json': { schema: errorResponse } } },
    503: {
      description: 'TicketSBT 미배포',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/internal/tickets/{tokenId}',
  tags: ['티켓'],
  summary: '티켓 온체인 데이터 조회',
  description:
    '소유권 확인과 대사(reconciliation)에 씁니다.\n\n' +
    '**얼굴 벡터·좌석·공연 정보는 여기 없습니다.** 체인이 아는 것은 ' +
    '"이 번호를 지금 누가 갖고 있는가" 뿐이고, 나머지는 Spring 의 티켓 DB 에 있습니다.\n\n' +
    '발행 응답이 `ALREADY_ISSUED` 라 `txHash` 가 없을 때, 확정 확인을 여기서 합니다 — ' +
    '`owner` 가 있으면 확정된 것이고, `404` 면 앞선 트랜잭션이 아직 안 실린 것입니다.\n\n' +
    '### 소각된 티켓과 없는 번호는 다릅니다\n\n' +
    '| | |\n' +
    '|---|---|\n' +
    '| `200` `burned: false` | 살아 있는 티켓 |\n' +
    '| `200` `burned: true` · `owner: null` | 발행됐다가 취소되어 소각됨 |\n' +
    '| `404` | 발행된 적 없는 번호 |\n\n' +
    '`ownerOf` 는 뒤의 둘을 똑같이 거부하기 때문에, 컨트랙트가 `ticketKeyHash` 를 ' +
    '소각 후에도 남겨 둘을 갈라줍니다.\n\n' +
    '**화면용 조회로 쓰지 마세요.** "내 티켓 목록" 은 Spring 이 자기 DB 에서 내려줍니다. ' +
    '체인은 그게 진짜임을 증명하는 레이어지 조회 소스가 아닙니다 (DESIGN.md 4-5).',
  security: [{ [internalKey.name]: [] }],
  request: {
    params: registry.register(
      'TicketIdParam',
      ticketParams.openapi({ example: { tokenId: TOKEN_ID_EXAMPLE } }),
    ),
  },
  responses: {
    200: {
      description: '티켓 상태 (소각된 티켓 포함)',
      content: { 'application/json': { schema: ticketResponse } },
    },
    400: {
      description: '`tokenId` 가 1 이상의 정수 문자열이 아닙니다',
      content: { 'application/json': { schema: errorResponse } },
    },
    404: {
      description: '발행된 적 없는 번호입니다 (`TICKET_NOT_FOUND`)',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description: 'TicketSBT 미배포',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/internal/tickets/{tokenId}/burn',
  tags: ['티켓'],
  summary: '티켓 소각 (예매 취소)',
  description:
    '**토큰을 파괴합니다. 되돌릴 수 없습니다.** 요청 본문은 없습니다.\n\n' +
    '소각하면 `ownerOf` 가 실패하므로 **존재 자체가 유효성**이 됩니다.\n\n' +
    '### tokenId 는 재사용되지 않습니다\n\n' +
    '취소표가 다른 사람에게 갈 때는 **새 `ticketKey` 로 새 `tokenId`** 가 나갑니다. ' +
    '같은 `ticketKey` 로 다시 부르면 `ALREADY_ISSUED` 로 막힙니다 — 취소된 예매가 ' +
    '되살아나면 안 되기 때문입니다.\n\n' +
    '### 소각 이력\n\n' +
    '조회 가능한 상태에서는 사라지지만 `Transfer(owner → 0x0)` **이벤트 로그**에는 ' +
    '영구히 남습니다. 다만 로그는 상태가 아니라, 꺼내려면 블록 범위를 훑는 인덱서가 ' +
    '필요합니다.\n\n' +
    '### 정지 스위치가 걸리지 않는 유일한 쓰기입니다\n\n' +
    '사고로 발행을 멈춰도 환불 경로는 살아 있어야 합니다 ' +
    '(DESIGN.md 결정 이력 2026-09-02).\n\n' +
    '소각이 확정된 뒤 캣머니를 환급하세요. 순서가 반대면 환급만 나가고 티켓이 ' +
    '살아 있는 상태가 생깁니다.\n\n' +
    TICKET_PENDING,
  security: [{ [internalKey.name]: [] }],
  request: {
    params: registry.register(
      'TicketBurnParam',
      ticketParams.openapi({ example: { tokenId: TOKEN_ID_EXAMPLE } }),
    ),
  },
  responses: {
    202: {
      description: '전송했습니다',
      content: { 'application/json': { schema: burnResponse } },
    },
    200: {
      description: '이미 소각된 티켓입니다. 새 트랜잭션을 보내지 않았습니다',
      content: { 'application/json': { schema: burnResponse } },
    },
    404: {
      description: '발행된 적 없는 번호입니다 (`TICKET_NOT_FOUND`)',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description: 'TicketSBT 미배포',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

/* ── /internal/photocards ──────────────────────────────────────── */

/* **tokenId 는 카드 한 장이 아니라 도안입니다.** 같은 도안의 두 장은 체인에서
   구별되지 않아서, 체인이 답하는 질문은 "이 사람이 이 도안을 몇 장 갖고 있나"
   하나입니다. 좌석·소유자·거래 이력은 Spring DB 가 소유합니다. */

const DESIGN_ID_EXAMPLE = '11';
const CID_EXAMPLE = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';

const designResponse = registry.register(
  'PhotocardDesignResult',
  z.object({
    status: z.enum(['PENDING', 'ALREADY_DONE']).openapi({
      description:
        '`ALREADY_DONE` 은 **같은 수량·같은 CID 로** 이미 등록돼 있어 새 트랜잭션을 ' +
        '보내지 않았다는 뜻입니다 — 재시도가 안전한 이유입니다.',
    }),
    txHash: z.string().nullable().openapi({ description: '`ALREADY_DONE` 이면 null' }),
    designId: z.string().openapi({ example: DESIGN_ID_EXAMPLE }),
    maxSupply: z.string().openapi({ example: '100' }),
    metadataUri: z.string().openapi({
      description: '온체인 `uri(tokenId)` 가 돌려줄 값. `ipfs://` 는 서버가 붙입니다',
    }),
  }),
);

type _DesignMatches = Assert<Exact<z.infer<typeof designResponse>, DesignRegisterResult>>;

const photocardIssueResponse = registry.register(
  'PhotocardIssueResult',
  z.object({
    status: z.literal('PENDING'),
    txHash: z.string().openapi({ example: '0xabc123…' }),
    count: z.number().int().openapi({ example: 200, description: '이 트랜잭션에 담긴 카드 수' }),
  }),
);

type _PhotocardIssueMatches = Assert<
  Exact<z.infer<typeof photocardIssueResponse>, IssueBatchResult>
>;

const photocardLookupResponse = registry.register(
  'PhotocardLookup',
  z.object({
    issued: z.boolean().openapi({ description: '이 `photocardKey` 로 발행된 적이 있는지' }),
  }),
);

type _PhotocardLookupMatches = Assert<
  Exact<z.infer<typeof photocardLookupResponse>, PhotocardLookupResult>
>;

const photocardBalanceResponse = registry.register(
  'PhotocardBalance',
  z.object({
    address: z.string().openapi({ example: ADDRESS_EXAMPLE }),
    designId: z.string().openapi({ example: DESIGN_ID_EXAMPLE }),
    balance: z.string().openapi({ example: '3', description: '이 주소가 가진 그 도안의 장수' }),
    totalSupply: z.string().openapi({ example: '87', description: '지금까지 발행된 총 장수' }),
    maxSupply: z.string().openapi({
      example: '100',
      description: '한정 수량. **`"0"` 이면 아직 등록되지 않은 도안입니다**',
    }),
  }),
);

type _PhotocardBalanceMatches = Assert<
  Exact<z.infer<typeof photocardBalanceResponse>, PhotocardBalanceResult>
>;

registry.registerPath({
  method: 'post',
  path: '/internal/photocards/designs',
  tags: ['포토카드'],
  summary: '포토카드 도안 등록 (한정 수량 · IPFS)',
  description:
    '**전체 흐름의 첫 단계입니다.** 등록되지 않은 도안으로 발행하면 배치 전체가 ' +
    '거부됩니다 (`DESIGN_NOT_REGISTERED`).\n\n' +
    '```\n여기 → 추첨 열기 → (한 블록) → 추첨 공개 → 배정 계산 → 발행\n```\n\n' +
    '추첨보다 먼저인 이유는, 도안별 수량이 추첨의 `inputsHash` 에 들어가는데 체인에 ' +
    '등록돼 있지 않으면 그 수량이 아무 의미가 없어서입니다.\n\n' +
    '### 첫 장이 발행되면 잠깁니다\n\n' +
    '한 장도 안 나간 동안은 **다시 불러서 수량과 CID 를 고칠 수 있습니다.** 개발 중에 ' +
    '이미지가 바뀌는 건 정상이고, 보유자가 없으면 바꿔도 다치는 사람이 없습니다.\n\n' +
    '**첫 장이 나가는 순간 영구히 동결됩니다** (`DESIGN_FROZEN`). 그 카드를 받은 사람에게 ' +
    '"이 그림, 이 수량" 을 약속한 뒤라서입니다. 포카에는 소각이 없어 한 번 잠기면 ' +
    '풀리지 않습니다.\n\n' +
    '### `metadataCid` 는 메타데이터 JSON 의 CID 입니다\n\n' +
    '```\ntokenId 11 → uri(11) → ipfs://bafyMETA → { "image": "ipfs://bafyIMG" } → 그림\n```\n\n' +
    '**Spring 이 메타데이터를 서빙하지 않습니다.** 지갑이 IPFS 에서 직접 가져갑니다. ' +
    '핀 고정은 도안을 만드는 자리에서 Spring 이 하고, **Pinata 를 두 번 부르며 순서가 ' +
    '정해져 있습니다** — 메타데이터 JSON 안에 이미지 CID 가 들어가야 합니다.\n\n' +
    '```\n① 이미지 → pin → imageCid\n② JSON   → pin → metadataCid   ← 여기로 보내는 값\n```\n\n' +
    '⚠️ **`imageCid` 가 아니라 `metadataCid` 를 보내세요.** 이미지 CID 를 보내면 지갑이 ' +
    'JSON 대신 이미지 바이트를 파싱하려 들어 카드가 이름도 없이 깨져 보입니다.\n\n' +
    '`designs.image_url` 에는 게이트웨이 URL 을 넣어두세요 — `ipfs://` 는 브라우저가 ' +
    '못 열어서 화면 코드가 그대로 못 씁니다.\n\n' +
    TICKET_PENDING,
  security: [{ [internalKey.name]: [] }],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: registry.register(
            'PhotocardDesignRequest',
            designBody.openapi({
              example: { designId: DESIGN_ID_EXAMPLE, maxSupply: '100', metadataCid: CID_EXAMPLE },
            }),
          ),
        },
      },
    },
  },
  responses: {
    202: {
      description: '등록 트랜잭션을 보냈습니다',
      content: { 'application/json': { schema: designResponse } },
    },
    200: {
      description: '같은 값으로 이미 등록돼 있습니다. 새 트랜잭션을 보내지 않았습니다',
      content: { 'application/json': { schema: designResponse } },
    },
    409: {
      description:
        '이미 카드가 발행된 도안이라 잠겼습니다 (`DESIGN_FROZEN`). ' +
        '수량이나 이미지를 바꿔야 하면 **새 도안**으로 만드세요',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description: 'PhotocardNFT 미배포 (`CONTRACT_UNAVAILABLE`)',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/internal/photocards/issue',
  tags: ['포토카드'],
  summary: '포토카드 배치 발행',
  description:
    '공연 하나의 카드를 **한 트랜잭션에** 발행합니다.\n\n' +
    '### 배정은 추첨에서 나옵니다\n\n' +
    '`items` 의 `designId` 를 임의로 정하지 마세요. ' +
    '`POST /internal/draws/{drawKey}/assign` 이 돌려준 배정을 그대로 씁니다 — 그 값이어야 ' +
    '"이 사람이 이 도안을 받은 것은 조작이 아니다" 가 체인의 난수로 증명됩니다.\n\n' +
    '배정 결과로 `nft_photocards` 행을 먼저 만드세요. `design_id` 가 `NOT NULL` 이라 ' +
    '배정 없이는 행을 만들 수 없고, 행이 없으면 `photocardKey` 도 없습니다.\n\n' +
    '### 같은 배치를 다시 보내도 안전합니다\n\n' +
    '이미 발행된 `photocardKey` 는 컨트랙트가 **건너뜁니다.** revert 하지 않습니다 — ' +
    '중복 하나가 200건을 통째로 죽이면 안 되기 때문입니다. 응답을 못 받았을 때 ' +
    '**같은 본문을 그대로 재전송하는 것**이 정답입니다.\n\n' +
    '### 한 요청 = 한 트랜잭션. 상한 200건\n\n' +
    '그 이상은 잘라서 여러 번 부르세요. 서버가 안에서 몰래 쪼개면 `txHash` 하나가 ' +
    '거짓말이 됩니다. 각 배치는 독립적으로 멱등이라 **실패한 조각만** 다시 보내면 됩니다.\n\n' +
    '### 결과는 우리가 DB 에 적습니다\n\n' +
    '`txHash` 를 폴링하지 않아도 됩니다. 이 서비스가 `nft_photocards` 의 `status`·' +
    '`token_id`·`chain_id`·`contract_address`·`mint_tx_hash`·`minted_at` 을 직접 ' +
    '갱신합니다 (DESIGN.md 1장 예외).\n\n' +
    '```\nPENDING → MINTING (전송됨) → MINTED / FAILED\n```\n\n' +
    '**그래서 Spring 엔티티에서 위 컬럼들을 `updatable = false` 로 두어야 합니다.** ' +
    '안 그러면 로드해 둔 `NftPhotocard` 가 flush 되면서 우리 UPDATE 를 덮어씁니다.\n\n' +
    '⚠️ `GET /internal/tx/{txHash}` 의 `result.tokenId` 는 보지 마세요 — 이벤트가 ' +
    '200개라 그중 하나만 담깁니다.\n\n' +
    '### 이미지·좌석을 보내지 마세요\n\n' +
    '그림은 **도안의 속성**입니다. `designId` 가 이미 그것을 가리키고, 지갑은 ' +
    '`uri(designId)` 가 가리키는 IPFS 메타데이터에서 읽습니다.\n\n' +
    '주의: `to` 는 **`POST /internal/wallets` 가 만들어준 파생 지갑**이어야 합니다. ' +
    '외부 지갑으로 나가면 마켓에서 그 카드를 옮길 수 없습니다.\n\n' +
    TICKET_PENDING,
  security: [{ [internalKey.name]: [] }],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: registry.register(
            'PhotocardIssueRequest',
            photocardIssueBody.openapi({
              example: {
                items: [
                  { photocardKey: '90123', designId: '11', to: ADDRESS_EXAMPLE },
                  { photocardKey: '90124', designId: '12', to: ADDRESS_EXAMPLE },
                ],
              },
            }),
          ),
        },
      },
    },
  },
  responses: {
    202: {
      description: '전송했습니다. 결과는 `nft_photocards.status` 로 확인하세요',
      content: { 'application/json': { schema: photocardIssueResponse } },
    },
    400: {
      description:
        '본문 형식 오류, `to` 의 EIP-55 체크섬 오류(`INVALID_ADDRESS`), ' +
        '또는 등록되지 않은 도안이 섞여 있습니다 (`DESIGN_NOT_REGISTERED`)',
      content: { 'application/json': { schema: errorResponse } },
    },
    422: {
      description:
        '한정 수량을 넘깁니다 (`DESIGN_SOLD_OUT`). 이미 발행된 장수 + 이 배치의 장수가 ' +
        '`maxSupply` 를 넘는 도안이 있습니다',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description:
        'PhotocardNFT 미배포(`CONTRACT_UNAVAILABLE`), 또는 운영자가 발행을 정지시켰습니다 ' +
        '(`CONTRACT_PAUSED`)',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/internal/photocards/by-key',
  tags: ['포토카드'],
  summary: 'photocardKey 로 발행 여부 조회',
  description:
    '발행 요청을 보냈는데 **응답을 못 받았을 때** 쓰는 복구 조회입니다.\n\n' +
    '발행되지 않았어도 `200` 에 `{ "issued": false }` 로 내려갑니다. 404 가 아닙니다 — ' +
    '404 로 만들면 "아직 안 됨" 과 "경로가 틀림" 을 구분할 수 없습니다.\n\n' +
    '### 티켓의 `by-key` 와 달리 `issued` 하나만 옵니다\n\n' +
    '티켓은 `tokenId = keccak256(ticketKey)` 라 키에서 번호가 나왔습니다. 포카는 ' +
    '`tokenId` 가 **도안**이라 카드 키에서 계산되지 않고, 컨트랙트도 `키 → 도안·소유자` ' +
    '를 저장하지 않습니다 — 그건 `nft_photocards` 행이 이미 갖고 있어 체인에 두면 ' +
    '두 벌이 됩니다.\n\n' +
    '소유 현황은 `GET /internal/photocards/balance` 를 쓰세요.\n\n' +
    '`photocardKey` 는 자유 문자열이므로 **URL 인코딩해서** 보내세요.',
  security: [{ [internalKey.name]: [] }],
  request: {
    query: registry.register(
      'PhotocardKeyQuery',
      photocardKeyQuery.openapi({ example: { key: '90123' } }),
    ),
  },
  responses: {
    200: {
      description: '발행 여부',
      content: { 'application/json': { schema: photocardLookupResponse } },
    },
    400: {
      description: '`key` 가 비었습니다',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description: 'PhotocardNFT 미배포',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/internal/photocards/balance',
  tags: ['포토카드'],
  summary: '도안별 보유 장수 조회 (대사용)',
  description:
    '**대사(reconciliation) 전용입니다. 화면용으로 쓰지 마세요** (DESIGN.md 4-5). ' +
    '"내 포카 목록" 은 Spring 이 자기 DB 에서 내려줍니다 — 매 요청이 여기를 타면 ' +
    'RPC 레이트리밋에 걸립니다.\n\n' +
    '### 맞춰볼 값\n\n' +
    '```sql\nSELECT count(*) FROM nft_photocards\n' +
    " WHERE owner_id = ? AND design_id = ? AND status = 'MINTED'\n```\n\n" +
    '이 값이 응답의 `balance` 와 같아야 합니다. `totalSupply` 는 `designs.issued_supply` ' +
    '와 맞춰봅니다.\n\n' +
    '카드 한 장을 지목해 묻는 조회는 없습니다. 같은 도안의 두 장은 체인에서 구별되지 ' +
    '않기 때문입니다 — **개수로만 맞춥니다.**',
  security: [{ [internalKey.name]: [] }],
  request: {
    query: registry.register(
      'PhotocardBalanceQuery',
      photocardBalanceQuery.openapi({
        example: { address: ADDRESS_EXAMPLE, designId: DESIGN_ID_EXAMPLE },
      }),
    ),
  },
  responses: {
    200: {
      description: '보유 장수와 도안의 발행 현황',
      content: { 'application/json': { schema: photocardBalanceResponse } },
    },
    400: {
      description: '주소의 EIP-55 체크섬이 틀립니다 (`INVALID_ADDRESS`)',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description: 'PhotocardNFT 미배포',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

const photocardTransferResponse = registry.register(
  'PhotocardTransferResult',
  z.object({
    status: z.enum(['PENDING', 'ALREADY_DONE']).openapi({
      description:
        '`ALREADY_DONE` 은 **그 판매자가 그 키로 이미 옮겼다**는 뜻입니다 — 새 트랜잭션을 ' +
        '보내지 않았습니다. 재시도가 안전한 이유입니다.',
    }),
    txHash: z.string().nullable().openapi({ description: '`ALREADY_DONE` 이면 null' }),
  }),
);

type _PhotocardTransferMatches = Assert<
  Exact<z.infer<typeof photocardTransferResponse>, PhotocardTransferResult>
>;

registry.registerPath({
  method: 'post',
  path: '/internal/photocards/transfer',
  tags: ['포토카드'],
  summary: '포토카드 소유권 이전 (마켓 정산)',
  description:
    '판매자 → 구매자로 카드를 옮깁니다.\n\n' +
    '컨트랙트의 `transferWithKey` 를 부릅니다. 표준 `safeTransferFrom` 을 쓰지 않는 ' +
    '이유는 거기엔 `operationKey` 를 걸 자리가 없어서입니다 — 응답을 못 받고 ' +
    '재시도하면 **카드가 두 장 넘어갑니다.**\n\n' +
    '서버가 `derivationIndex` 로 **판매자 본인의 키를 파생해 서명합니다.** ' +
    '오퍼레이터가 남의 카드를 옮기는 함수는 컨트랙트에 두지 않았습니다 — 캣머니에 ' +
    '`burnFrom` 을 안 둔 것과 같은 이유입니다. 계산한 주소가 `from` 과 다르면 `400`, ' +
    '`from` 과 `to` 가 같아도 `400` 입니다.\n\n' +
    '같은 `operationKey` 가 다시 오면 `200` + `ALREADY_DONE` 입니다.\n\n' +
    '### 캣머니 전송과 순서가 있습니다\n\n' +
    '**둘은 원자적이지 않습니다.** 서로 다른 컨트랙트의 서로 다른 트랜잭션입니다.\n\n' +
    '```\n' +
    '① 캣머니 전송 (구매자 → 판매자)   확정까지 기다림\n' +
    '② 카드 이전   (판매자 → 구매자)   ← 여기\n' +
    '   실패하면 → 캣머니를 되돌립니다 (판매자 → 구매자, 별도 operationKey 로)\n' +
    '```\n\n' +
    '반대로 하면 카드가 먼저 넘어간 뒤 결제가 실패했을 때 되돌릴 방법이 없습니다 — ' +
    '구매자가 그 사이 다시 팔아버리면 끝입니다. **이 순서는 Spring 이 소유합니다.**\n\n' +
    '### 이 서비스는 거래 상태를 기록하지 않습니다\n\n' +
    '발행과 다른 지점입니다. 발행은 확정을 감시해 `nft_photocards` 를 직접 갱신하지만, ' +
    '이전은 `202` + `txHash` 만 돌려주고 끝납니다. `nft_photocard_trades` 에 ' +
    '`settle_tx_hash`·`transfer_tx_hash` 와 거래 상태 컬럼이 아직 없기 때문입니다 ' +
    '— **두 다리 사이의 미확정 구간은 Spring 이 소유합니다.**\n\n' +
    '### `amount` 는 항상 `"1"` 입니다\n\n' +
    '컨트랙트는 ERC-1155 라 수량을 받지만 마켓 거래는 카드 한 장 단위입니다.\n\n' +
    '### 발행 정지는 이전에 걸리지 않습니다\n\n' +
    '유저가 자기 카드를 옮기는 것은 발행 사고와 무관합니다. `issuePaused` 가 켜져 있어도 ' +
    '이 API 는 동작합니다.',
  security: [{ [internalKey.name]: [] }],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: registry.register(
            'PhotocardTransferRequest',
            photocardTransferBody.openapi({
              example: {
                operationKey: 'poca_trade_20260908_00001',
                from: ADDRESS_EXAMPLE,
                derivationIndex: 42,
                to: '0x82b00adc4bb58753d25b860204f378065172a950',
                designId: DESIGN_ID_EXAMPLE,
                amount: '1',
                tradeId: 'trade_00001',
              },
            }),
          ),
        },
      },
    },
  },
  responses: {
    202: {
      description: '전송했습니다. 확정은 `GET /internal/tx/{txHash}`',
      content: { 'application/json': { schema: photocardTransferResponse } },
    },
    200: {
      description: '이미 처리된 `operationKey` 입니다. 새 트랜잭션을 보내지 않았습니다',
      content: { 'application/json': { schema: photocardTransferResponse } },
    },
    400: {
      description:
        '본문 형식 오류, `to` 의 EIP-55 체크섬 불일치(`INVALID_ADDRESS`), ' +
        '`derivationIndex` 로 만든 주소가 `from` 과 다름, 또는 `from` 과 `to` 가 같음',
      content: { 'application/json': { schema: errorResponse } },
    },
    422: {
      description:
        '판매자가 그 도안을 그만큼 갖고 있지 않습니다 (`INSUFFICIENT_BALANCE`). ' +
        '등록되지 않은 도안도 보유 장수가 0 이라 여기로 옵니다',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description: 'PhotocardNFT 미배포',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

/* ── /internal/draws ───────────────────────────────────────────── */

/* 커밋-리빌 + 블록해시. **체인이 만드는 것은 난수 하나뿐이고**, 배정은 그 난수로부터
   계산되는 순수 함수라 누가 계산하든 같습니다. 그래서 배정을 온체인에 두지 않습니다. */

const drawOpenResponse = registry.register(
  'DrawOpenResult',
  z.object({
    status: z.literal('PENDING'),
    txHash: z.string().openapi({ example: '0xabc123…' }),
    drawId: z.string().openapi({ description: '`drawKey` 의 keccak256' }),
    inputsHash: z.string().openapi({
      description: '체인에 박힌 입력 해시. 배정을 계산할 때 이 값과 대조됩니다',
    }),
  }),
);

type _DrawOpenMatches = Assert<Exact<z.infer<typeof drawOpenResponse>, DrawOpenResult>>;

const drawRevealResponse = registry.register(
  'DrawRevealResult',
  z.object({ status: z.literal('PENDING'), txHash: z.string() }),
);

type _DrawRevealMatches = Assert<Exact<z.infer<typeof drawRevealResponse>, DrawRevealResult>>;

const drawStateResponse = registry.register(
  'DrawState',
  z.object({
    exists: z.boolean().openapi({ description: '**false 면 나머지 필드는 의미가 없습니다**' }),
    status: z.enum(['OPEN', 'REVEALED', 'CANCELED']).nullable(),
    commitBlock: z.number().int().nullable().openapi({ example: 11214710 }),
    targetBlock: z.number().int().nullable().openapi({
      example: 11214711,
      description: '난수에 섞을 블록. **커밋 다음 블록**입니다',
    }),
    revealable: z.boolean().openapi({
      description:
        '지금 공개를 부를 수 있는지. `targetBlock` 이 생겼고 아직 256블록 안이면 true 입니다',
    }),
    randomness: z.string().nullable().openapi({
      description:
        '`REVEALED` 일 때만 값이 있습니다. 프론트 `DrawResult.randomness` 에 그대로 ' +
        '실어주면 유저가 탐색기에서 직접 확인할 수 있습니다',
    }),
    inputsHash: z.string().nullable(),
  }),
);

type _DrawStateMatches = Assert<Exact<z.infer<typeof drawStateResponse>, DrawStateResult>>;

const drawAssignResponse = registry.register(
  'DrawAssignResult',
  z.object({
    randomness: z.string(),
    assignments: z
      .array(
        z.object({
          ticketId: z.string().openapi({ example: '5501' }),
          designId: z.string().openapi({ example: '11' }),
        }),
      )
      .openapi({ description: '`ticketIds` 와 같은 순서로 돌아옵니다' }),
  }),
);

type _DrawAssignMatches = Assert<Exact<z.infer<typeof drawAssignResponse>, DrawAssignResult>>;

const DRAW_INPUTS_EXAMPLE = {
  performanceId: '42',
  ticketIds: ['5501', '5502', '5503'],
  designIds: ['11', '12'],
  quantities: ['2', '1'],
};

registry.registerPath({
  method: 'post',
  path: '/internal/draws/open',
  tags: ['추첨'],
  summary: '추첨 열기 (커밋)',
  description:
    '어떤 티켓이 어떤 도안을 받을지 **정하기 전에** 부릅니다.\n\n' +
    '서버가 시드를 하나 정해 **해시만** 체인에 올립니다. 시드 자체는 공개 단계에서 ' +
    '나오므로, 나중에 결과를 보고 시드를 바꿀 수 없습니다.\n\n' +
    '### 참여자와 수량이 여기서 굳습니다\n\n' +
    '`keccak256(performanceId, ticketIds, designIds, quantities)` 를 커밋과 **같은 ' +
    '트랜잭션에** 올립니다. **이게 이 API 의 핵심입니다** — 난수만 고정하고 입력을 ' +
    '안 고정하면, 서버가 결과를 본 뒤 참여자 순서를 바꿔 원하는 사람에게 원하는 도안을 ' +
    '줄 수 있습니다. 난수는 진짜인데 배정은 조작인 상태가 됩니다.\n\n' +
    '**`ticketIds` 와 `designIds` 는 중복 없이 오름차순이어야 합니다.** 순서가 어긋난 채 ' +
    '커밋되면 배정 단계에서 해시가 안 맞는데, 그때는 이미 커밋이 체인에 남아 그 추첨을 ' +
    '통째로 버려야 합니다. 그래서 보내기 전에 막습니다.\n\n' +
    '### 공개는 서버가 자동으로 합니다\n\n' +
    '`blockhash` 가 256블록(약 42분)만 남아서 그 시한을 놓치면 추첨이 죽습니다. ' +
    '**Spring 이 공개를 예약할 필요가 없습니다** — 이 서비스가 감시하다가 대상 블록이 ' +
    '생기면 알아서 공개합니다. 진행 상황은 `GET /internal/draws/{drawKey}` 로 봅니다.\n\n' +
    '### 한 번 쓴 `drawKey` 는 다시 못 씁니다\n\n' +
    '취소된 추첨의 키도 막힙니다. 재사용을 허용하면 다시 뽑은 흔적이 덮입니다. ' +
    '**`performanceId` 를 키 문자열에 넣으세요** — 같은 공연에 추첨이 몇 번 열렸는지가 ' +
    '눈에 띄어야 합니다.\n\n' +
    '도안 등록(`POST /internal/photocards/designs`)이 먼저입니다.\n\n' +
    TICKET_PENDING,
  security: [{ [internalKey.name]: [] }],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: registry.register(
            'DrawOpenRequest',
            openBody.openapi({
              example: { drawKey: 'photocard_draw_perf_42', ...DRAW_INPUTS_EXAMPLE },
            }),
          ),
        },
      },
    },
  },
  responses: {
    202: {
      description: '커밋을 보냈습니다. 공개는 서버가 자동으로 합니다',
      content: { 'application/json': { schema: drawOpenResponse } },
    },
    400: {
      description: '수량 합계가 `ticketIds` 길이와 다르거나, 오름차순이 아닙니다',
      content: { 'application/json': { schema: errorResponse } },
    },
    409: {
      description: '이미 쓴 `drawKey` 입니다 (`DRAW_ALREADY_EXISTS`)',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description:
        'VerifiableDraw 미배포(`CONTRACT_UNAVAILABLE`) 또는 서버에 시드 비밀이 없습니다 ' +
        '(`DRAW_NOT_CONFIGURED`)',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/internal/draws/{drawKey}',
  tags: ['추첨'],
  summary: '추첨 상태 조회',
  description:
    '공개됐는지, 난수가 무엇인지 확인합니다.\n\n' +
    '열린 적 없어도 `200` 에 `{ "exists": false }` 로 내려갑니다. 404 가 아닙니다 — ' +
    '404 로 만들면 "아직 안 열림" 과 "경로가 틀림" 을 구분할 수 없습니다.\n\n' +
    '`status` 가 `REVEALED` 가 되면 `POST …/assign` 으로 배정을 받아갑니다. ' +
    '보통 커밋 뒤 한 블록(약 10초)이면 됩니다 — 공개는 서버가 자동으로 합니다.',
  security: [{ [internalKey.name]: [] }],
  request: {
    params: registry.register(
      'DrawKeyParam',
      drawParams.openapi({ example: { drawKey: 'photocard_draw_perf_42' } }),
    ),
  },
  responses: {
    200: {
      description: '추첨 상태',
      content: { 'application/json': { schema: drawStateResponse } },
    },
    503: {
      description: 'VerifiableDraw 미배포',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/internal/draws/{drawKey}/reveal',
  tags: ['추첨'],
  summary: '추첨 공개 (수동 — 평소에는 서버가 자동으로 합니다)',
  description:
    '⚠️ **평소에는 부를 필요가 없습니다.** 이 서비스가 커밋을 감시하다가 대상 블록이 ' +
    '생기면 자동으로 공개합니다. 42분 시한을 사람 손에 맡기지 않기 위해서입니다.\n\n' +
    '이 경로는 **수동 개입용**입니다 — 감시가 죽어 있었거나 즉시 확정해야 할 때 씁니다. ' +
    '본문은 없습니다. 서버가 시드를 다시 파생합니다.\n\n' +
    '```\nrandomness = keccak256(시드, blockhash(커밋 다음 블록))\n```\n\n' +
    '커밋과 같은 블록에서는 부를 수 없습니다 (`409 TOO_EARLY`) — **조금 뒤에 다시 ' +
    '부르면 됩니다.** `GET` 의 `revealable` 로 확인하세요.\n\n' +
    TICKET_PENDING,
  security: [{ [internalKey.name]: [] }],
  request: {
    params: registry.register(
      'DrawRevealParam',
      drawParams.openapi({ example: { drawKey: 'photocard_draw_perf_42' } }),
    ),
  },
  responses: {
    202: {
      description: '공개를 보냈습니다',
      content: { 'application/json': { schema: drawRevealResponse } },
    },
    404: {
      description: '그 `drawKey` 로 열린 추첨이 없습니다',
      content: { 'application/json': { schema: errorResponse } },
    },
    409: {
      description:
        '아직 대상 블록이 없거나(`TOO_EARLY` — 재시도하세요), 이미 공개됐거나' +
        '(`ALREADY_REVEALED`), 취소된 추첨입니다 (`DRAW_CANCELED`)',
      content: { 'application/json': { schema: errorResponse } },
    },
    410: {
      description:
        '256블록이 지나 블록해시가 사라졌습니다 (`BLOCKHASH_EXPIRED`). ' +
        '**재시도로 풀리지 않습니다** — 새 `drawKey` 로 다시 여세요',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description: 'VerifiableDraw 미배포',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/internal/draws/{drawKey}/assign',
  tags: ['추첨'],
  summary: '배정 계산 (트랜잭션 없음)',
  description:
    '확정된 난수로 **누가 어떤 도안을 받는지** 계산해 돌려줍니다. 트랜잭션을 보내지 ' +
    '않으므로 `200` 입니다.\n\n' +
    '### 왜 이 API 가 있나\n\n' +
    '배정은 `f(randomness, 참여자, 수량)` 인 **순수 함수**라 원래 Spring 이 직접 계산해도 ' +
    '됩니다. 다만 keccak 이 필요한데 Spring 에 그 의존성을 만들지 않기로 했습니다 ' +
    '(DESIGN.md 결정 이력 2026-09-02). 그래서 계산도 서버가 해 줍니다.\n\n' +
    '### 입력을 다시 보내는 것이 곧 검사입니다\n\n' +
    '보낸 입력으로 `inputsHash` 를 다시 계산해 **체인에 박힌 값과 대조**합니다. ' +
    '하나라도 다르면 `400` 이고, 응답의 `detail` 에 양쪽 해시가 담깁니다 — 커밋 이후 ' +
    '참여자 목록이 바뀌지 않았다는 것이 이 대조로 증명됩니다.\n\n' +
    '### 같은 입력이면 언제 불러도 같은 답입니다\n\n' +
    '멱등이라 재시도해도 안전합니다. 이 결과로 `nft_photocards` 행을 만든 뒤 ' +
    '`POST /internal/photocards/issue` 로 발행하세요 — `design_id` 가 `NOT NULL` 이라 ' +
    '배정 없이는 행을 만들 수 없습니다.',
  security: [{ [internalKey.name]: [] }],
  request: {
    params: registry.register(
      'DrawAssignParam',
      drawParams.openapi({ example: { drawKey: 'photocard_draw_perf_42' } }),
    ),
    body: {
      required: true,
      content: {
        'application/json': {
          schema: registry.register(
            'DrawAssignRequest',
            assignBody.openapi({ example: DRAW_INPUTS_EXAMPLE }),
          ),
        },
      },
    },
  },
  responses: {
    200: {
      description: '배정 결과. `ticketIds` 와 같은 순서입니다',
      content: { 'application/json': { schema: drawAssignResponse } },
    },
    400: {
      description:
        '보낸 입력이 커밋할 때와 다릅니다 (`INPUTS_MISMATCH`). **정렬 순서까지 같아야 합니다**',
      content: { 'application/json': { schema: errorResponse } },
    },
    404: {
      description: '그 `drawKey` 로 열린 추첨이 없습니다',
      content: { 'application/json': { schema: errorResponse } },
    },
    409: {
      description: '아직 공개되지 않았거나(`NOT_REVEALED`) 취소된 추첨입니다 (`DRAW_CANCELED`)',
      content: { 'application/json': { schema: errorResponse } },
    },
    503: {
      description: 'VerifiableDraw 미배포',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
});

/* ── /internal/tx/{txHash} ─────────────────────────────────────── */

const txResponse = registry.register(
  'TxReport',
  z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'FAILED', 'ALREADY_DONE']).openapi({
      description:
        '`PENDING` 아직 블록에 안 실림 · `CONFIRMED` 성공 · ' +
        '`ALREADY_DONE` 같은 작업이 다른 트랜잭션으로 이미 처리됨(**성공으로 취급하세요**) · ' +
        '`FAILED` 컨트랙트가 거부',
    }),
    txHash: z.string(),
    blockNumber: z.number().int().nullable().openapi({ description: 'PENDING 이면 null' }),
    result: z
      .object({
        operation: z
          .enum([
            'CATMONEY_MINT',
            'CATMONEY_BURN',
            'CATMONEY_TRANSFER',
            'TICKET_ISSUE',
            'TICKET_BURN',
            'PHOTOCARD_DESIGN',
            'PHOTOCARD_ISSUE',
            'PHOTOCARD_TRANSFER',
            'DRAW_OPEN',
            'DRAW_REVEAL',
            'DRAW_CANCEL',
            'UNKNOWN',
          ])
          .openapi({
            description:
              '영수증 로그로 알아낸 작업. 우리 컨트랙트가 아니면 `UNKNOWN` 입니다',
          }),
        tokenId: z.string().nullable().openapi({
          description:
            '티켓 작업이면 채워집니다. 캣머니는 항상 null 입니다.\n\n' +
            '**발행한 티켓의 번호를 여기서 받습니다.** `POST /internal/tickets/issue` 는 ' +
            '확정을 기다리지 않으므로 응답에 tokenId 가 없습니다.\n\n' +
            '⚠️ **포토카드 배치 발행에서는 보지 마세요.** 한 트랜잭션에 카드가 최대 ' +
            '200장이라 여기 담기는 건 그중 **첫 번째 것 하나**뿐입니다. 포카의 결과는 ' +
            '`nft_photocards.status` 로 확인하세요 — 이 서비스가 직접 갱신합니다.',
        }),
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

/* ── 문서 조립 ─────────────────────────────────────────────────── */

export function buildOpenApiDocument(): ReturnType<OpenApiGeneratorV3['generateDocument']> {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: '티캣 블록체인 내부 API',
      version: '0.1.0',
      description:
        'Spring 이 호출하는 내부 API 입니다. **프론트엔드가 직접 호출하지 않습니다.**\n\n' +
        '여기 있는 것은 전부 구현돼 있습니다. 계약만 먼저 올려두던 `(예정)` 태그는 ' +
        '마켓 정산이 붙으면서 없어졌습니다.\n\n' +
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
      { name: '티켓', description: '양도할 수 없습니다. 취소는 소각입니다' },
      {
        name: '캣머니',
        description:
          '**발행·소각으로만 움직입니다** (트레저리 없음). 예외는 포카 마켓 정산의 ' +
          '유저 간 전송 하나인데, 그것도 `totalSupply` 는 건드리지 않습니다',
      },
      {
        name: '포토카드',
        description:
          'ERC-1155. **`tokenId` 는 카드 한 장이 아니라 도안입니다** — 체인은 ' +
          '"이 사람이 이 도안을 몇 장 갖고 있나" 만 답합니다. 발행 결과는 이 서비스가 ' +
          '`nft_photocards` 에 직접 기록합니다',
      },
      {
        name: '추첨',
        description:
          '커밋-리빌 + 블록해시. **체인이 만드는 것은 난수 하나뿐이고** 배정은 그 난수로부터 ' +
          '계산되는 순수 함수라 누가 계산하든 같습니다. 공개는 서버가 자동으로 합니다',
      },
      { name: '트랜잭션', description: '모든 쓰기의 확정 확인' },
    ],
  });
}
