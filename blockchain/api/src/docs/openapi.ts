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
import { issueBody, ticketKeyQuery, ticketParams } from '../controllers/ticket.controller';
import type {
  BurnResult,
  IssueResult,
  TicketLookupResult,
  TicketResult,
} from '../services/ticket.service';
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
            '확정을 기다리지 않으므로 응답에 tokenId 가 없습니다.',
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
      { name: '티켓', description: '양도할 수 없습니다. 취소는 소각이 아니라 상태 전이입니다' },
      { name: '캣머니', description: '발행·소각으로만 움직입니다 (트레저리 없음)' },
      { name: '캣머니 (예정)', description: '아직 만들지 않았습니다 — 호출하면 404' },
      { name: '트랜잭션', description: '모든 쓰기의 확정 확인' },
    ],
  });
}
