import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

/**
 * **아직 구현되지 않은** 엔드포인트의 계약.
 *
 * Spring 팀이 붙일 곳을 미리 볼 수 있도록 적어둡니다. 여기 있는 것을 호출하면
 * **404 가 납니다.** 그래서 태그와 summary 에 `[미구현]` 을 붙여 구현된 것과 갈라둡니다.
 *
 * 기능을 실제로 만들면 **이 파일에서 지우고 `openapi.ts` 로 옮기세요.**
 * 거기서는 컨트롤러의 zod 스키마를 그대로 쓰고, 응답은 타입과 대조하는 가드가 붙습니다.
 * 여기 있는 스키마는 대조할 코드가 아직 없어서 가드가 없습니다 — 손으로 맞춰야 합니다.
 *
 * ⚠️ **옮겼으면 여기서 반드시 지우세요.** 같은 경로를 양쪽에서 등록하면 한쪽이
 * 조용히 덮어써서, Swagger 에 옛 계약이 남아 있는데 아무도 모르는 상태가 됩니다.
 *
 * ── 남아 있는 것 ──────────────────────────────────────────────────
 * **마켓 정산**뿐입니다. 카드 이전과 캣머니 전송이 원자적이지 않아서 순서와 보상을
 * 먼저 정해야 하고, `nft_photocard_trades` 에 tx 컬럼도 없습니다.
 * (PHOTOCARD_PLAN.md 7장)
 *
 * 발행·추첨은 2026-09-08 에 구현되어 `openapi.ts` 로 옮겼습니다.
 */

const PENDING_DESCRIPTION =
  '블록 확정을 기다리지 않고 즉시 돌려줍니다. Spring 은 `txHash` 를 저장하고 ' +
  '`GET /internal/tx/{txHash}` 로 확정을 확인합니다. (DESIGN.md 4-2)';

export function registerPlannedPaths(registry: OpenAPIRegistry, internalKeyName: string): void {
  const secured = [{ [internalKeyName]: [] }];

  /* ── 공통 스키마 ────────────────────────────────────────────── */

  const accepted = registry.register(
    'Accepted',
    z.object({
      status: z.literal('PENDING'),
      txHash: z.string().openapi({ example: '0xabc123…' }),
    }),
  );

  /**
   * 수량은 **정수 문자열**입니다. `decimals = 0` 이라 소수가 없고,
   * JSON number 로 주고받으면 큰 값에서 정밀도가 깨집니다.
   */
  const amount = z.string().regex(/^[1-9][0-9]*$/, '0 보다 큰 정수 문자열').openapi({
    example: '500',
    description: '0 보다 큰 정수 문자열. `decimals = 0` 이라 소수점이 없습니다',
  });

  const operationKey = z.string().openapi({
    example: 'catmoney_deposit_20260902_00001',
    description:
      'Spring 이 만드는 영구 유일 키. 서버가 keccak256 으로 해싱해 온체인에 기록합니다.\n\n' +
      '같은 키로 다시 오면 컨트랙트가 거부하고, 이 서비스는 그것을 **성공으로 변환**합니다 — ' +
      'tx 를 보낸 직후 응답 전에 죽어도 재시도가 안전합니다. (DESIGN.md 4-3)',
  });

  const address = z.string().openapi({ example: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc' });

  const designId = z
    .string()
    .regex(/^[1-9][0-9]*$/, '1 이상의 정수 문자열')
    .openapi({
      example: '11',
      description: '`nft_photocard_designs.id`. **이 값이 그대로 온체인 `tokenId` 입니다.**',
    });

  /* ── 캣머니 ─────────────────────────────────────────────────── */

  registry.registerPath({
    method: 'post',
    path: '/internal/tokens/catmoney/transfer',
    tags: ['캣머니 (예정)'],
    summary: '[미구현] 캣머니 전송 (포카 마켓 정산)',
    description:
      '유저 → 유저로 캣머니를 옮깁니다. 포카 마켓에서 구매자가 판매자에게 낼 때 씁니다.\n\n' +
      '**발행도 소각도 아닙니다.** `totalSupply` 는 그대로고 소유자만 바뀝니다.\n\n' +
      '컨트랙트의 `transferWithKey` 를 부릅니다. 표준 `transfer` 를 쓰지 않는 이유는 ' +
      '거기엔 `operationKey` 를 걸 자리가 없어서입니다 — 응답을 못 받고 재시도하면 ' +
      '**구매자가 두 번 냅니다.**\n\n' +
      '서버가 `derivationIndex` 로 보내는 유저의 키를 파생해 서명합니다. ' +
      '계산한 주소가 `from` 과 다르면 `400` 입니다.\n\n' +
      '주의: 이 API 는 **돈만 옮깁니다.** NFT 소유권 이전은 별개이고, 둘이 원자적이지 ' +
      '않으면 한쪽만 성공할 수 있습니다. 순서와 보상 트랜잭션은 M6 착수 전에 정합니다.\n\n' +
      PENDING_DESCRIPTION,
    security: secured,
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: z.object({
              operationKey,
              from: address.openapi({ description: '보내는 유저의 지갑 주소' }),
              derivationIndex: z.number().int().min(0).openapi({ example: 42 }),
              to: address.openapi({ description: '받는 유저의 지갑 주소' }),
              amount,
              tradeId: z
                .string()
                .openapi({ example: 'trade_00001', description: 'Spring 거래 식별자' }),
            }),
          },
        },
      },
    },
    responses: {
      202: {
        description: '전송했습니다. 확정은 아직입니다',
        content: { 'application/json': { schema: accepted } },
      },
      400: { description: '`derivationIndex` 로 만든 주소가 `from` 과 다릅니다' },
      409: { description: '같은 `operationKey` 가 이미 처리됐습니다' },
      422: { description: '잔액이 부족합니다 (`INSUFFICIENT_BALANCE`)' },
    },
  });

  /* ── 포토카드 마켓 정산 ─────────────────────────────────────── */

  registry.registerPath({
    method: 'post',
    path: '/internal/photocards/transfer',
    tags: ['포토카드 (예정)'],
    summary: '[미구현] 포토카드 소유권 이전 (마켓 정산)',
    description:
      '판매자 → 구매자로 카드를 옮깁니다. **발행과 추첨은 이미 구현돼 있고 이것만 남았습니다.**\n\n' +
      '컨트랙트의 `transferWithKey` 를 부릅니다. 표준 `safeTransferFrom` 을 쓰지 않는 ' +
      '이유는 거기엔 `operationKey` 를 걸 자리가 없어서입니다 — 응답을 못 받고 ' +
      '재시도하면 **카드가 두 장 넘어갑니다.**\n\n' +
      '서버가 `derivationIndex` 로 **판매자 본인의 키를 파생해 서명합니다.** ' +
      '오퍼레이터가 남의 카드를 옮기는 함수는 컨트랙트에 두지 않았습니다 — 캣머니에 ' +
      '`burnFrom` 을 안 둔 것과 같은 이유입니다.\n\n' +
      '### 캣머니 전송과 순서가 있습니다\n\n' +
      '**둘은 원자적이지 않습니다.** 서로 다른 컨트랙트의 서로 다른 트랜잭션입니다.\n\n' +
      '```\n' +
      '① 캣머니 전송 (구매자 → 판매자)   확정까지 기다림\n' +
      '② 카드 이전   (판매자 → 구매자)\n' +
      '   실패하면 → 캣머니를 되돌립니다 (판매자 → 구매자, 보상 키로)\n' +
      '```\n\n' +
      '반대로 하면 카드가 먼저 넘어간 뒤 결제가 실패했을 때 되돌릴 방법이 없습니다 — ' +
      '구매자가 그 사이 다시 팔아버리면 끝입니다.\n\n' +
      '### 남은 준비\n\n' +
      '`nft_photocard_trades` 에 `settle_tx_hash`·`transfer_tx_hash` 와 거래 상태 컬럼이 ' +
      '없습니다. 지금은 한 DB 트랜잭션에서 소유권이 즉시 넘어가고 끝나서, 체인 두 다리 ' +
      '사이의 미확정 구간을 표현할 자리가 없습니다.\n\n' +
      '### `amount` 는 항상 `"1"` 입니다\n\n' +
      '컨트랙트는 ERC-1155 라 수량을 받지만 마켓 거래는 카드 한 장 단위입니다.\n\n' +
      PENDING_DESCRIPTION,
    security: secured,
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: z.object({
              operationKey: operationKey.openapi({
                example: 'poca_trade_20260907_00001',
                description:
                  'Spring 이 만드는 영구 유일 키(거래 PK 등). **호출자별로 기록됩니다** — ' +
                  '전역이면 카드 한 장 가진 아무나 남의 거래 키를 미리 태워 막을 수 있습니다',
              }),
              from: address.openapi({ description: '판매자의 파생 지갑 주소' }),
              derivationIndex: z.number().int().min(0).openapi({
                example: 42,
                description: '**판매자의** 파생 인덱스. 이 키로 서명합니다',
              }),
              to: address.openapi({ description: '구매자의 파생 지갑 주소' }),
              designId,
              amount: amount.openapi({ example: '1', description: '마켓 거래는 항상 `"1"`' }),
              tradeId: z.string().openapi({
                example: 'trade_00001',
                description: '`nft_photocard_trades.id`. 로그 추적용입니다',
              }),
            }),
          },
        },
      },
    },
    responses: {
      202: {
        description: '전송했습니다. 확정은 아직입니다',
        content: { 'application/json': { schema: accepted } },
      },
      400: { description: '`derivationIndex` 로 만든 주소가 `from` 과 다릅니다' },
      409: { description: '같은 `operationKey` 가 이미 처리됐습니다' },
      422: { description: '판매자가 그 도안을 갖고 있지 않습니다 (`INSUFFICIENT_BALANCE`)' },
      503: { description: 'PhotocardNFT 미배포' },
    },
  });
}
