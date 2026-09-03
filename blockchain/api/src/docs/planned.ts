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
 * 출처: 내부 API 명세서 초안 0.1 (2026-09-02) + 이후 결정
 *   - 캣머니는 트레저리로 모으지 않고 **발행/소각**으로만 움직입니다
 *   - 그래서 명세서의 `pay`/`refund` 는 `burn`/`mint` 로 대체됐습니다
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

  const ticketStatus = z.enum(['VALID', 'USED', 'CANCELED']);

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
      '않으면 한쪽만 성공할 수 있습니다. 마켓 컨트랙트에서 에스크로로 묶을지 ' +
      'Spring 이 보상 트랜잭션으로 처리할지는 M6 착수 전에 정합니다.\n\n' +
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
              tradeId: z.string().openapi({ example: 'trade_00001', description: 'Spring 거래 식별자' }),
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

  /* ── 티켓 ───────────────────────────────────────────────────── */

  registry.registerPath({
    method: 'post',
    path: '/internal/tickets/issue',
    tags: ['티켓 (예정)'],
    summary: '[미구현] 티켓 SBT 발행',
    description:
      '`ticketKey` 와 `seatInfo` 를 각각 `keccak256` 으로 해싱해 온체인에 기록합니다.\n\n' +
      '**좌석·공연 상세는 온체인에 넣지 않습니다.** 해시만 남깁니다.\n' +
      '**얼굴 벡터는 이 서비스로 보내지 마세요.** Spring 의 암호화된 저장소에 둡니다.\n\n' +
      '같은 `ticketKey` 로 재시도하면 티켓은 하나만 발행됩니다.\n\n' +
      PENDING_DESCRIPTION,
    security: secured,
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: z.object({
              ticketKey: z.string().openapi({ example: 'ticket_20260902_000001' }),
              to: address,
              seatInfo: z.string().openapi({
                example: 'SHOW-2026-001|SEAT-A-3-12',
                description: 'Spring 이 정규화한 문자열. 정규화 책임은 Spring 입니다',
              }),
            }),
          },
        },
      },
    },
    responses: {
      202: {
        description: '전송했습니다',
        content: { 'application/json': { schema: accepted } },
      },
      200: {
        description: '이미 발행된 `ticketKey` 입니다. 새 tx 를 보내지 않습니다',
        content: {
          'application/json': {
            schema: z.object({ status: z.literal('ALREADY_ISSUED'), tokenId: z.string() }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/internal/tickets/{tokenId}',
    tags: ['티켓 (예정)'],
    summary: '[미구현] 티켓 온체인 데이터 조회',
    description:
      '입장 인증에 쓰는 온체인 정보입니다.\n\n' +
      '**얼굴 벡터·얼굴 이미지·사용자 이름은 반환하지 않습니다.** ' +
      'Spring 이 `tokenId` 로 연결된 얼굴 벡터를 별도 저장소에서 꺼내 대조합니다.',
    security: secured,
    request: { params: z.object({ tokenId: z.string().openapi({ example: '12' }) }) },
    responses: {
      200: {
        description: '티켓 상태',
        content: {
          'application/json': {
            schema: z.object({
              tokenId: z.string(),
              owner: address,
              status: ticketStatus,
              ticketKeyHash: z.string(),
              seatHash: z.string(),
              exists: z.boolean(),
            }),
          },
        },
      },
      404: { description: '없는 `tokenId` 입니다 (`TICKET_NOT_FOUND`)' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/internal/tickets/by-key',
    tags: ['티켓 (예정)'],
    summary: '[미구현] ticketKey 로 발행 결과 조회',
    description:
      '발행 요청을 보냈는데 응답을 못 받았을 때 **결과를 복구**하는 용도입니다.\n\n' +
      '발행되지 않았어도 `200` 에 `{ "issued": false }` 로 내려갑니다. 404 가 아닙니다.\n\n' +
      '`ticketKey` 는 자유 문자열이므로 URL 인코딩해서 보내세요.',
    security: secured,
    request: { query: z.object({ key: z.string().openapi({ example: 'ticket_20260902_000001' }) }) },
    responses: {
      200: {
        description: '발행 여부',
        content: {
          'application/json': {
            schema: z.object({
              issued: z.boolean(),
              tokenId: z.string().optional(),
              owner: address.optional(),
              status: ticketStatus.optional(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/internal/tickets/{tokenId}/use',
    tags: ['티켓 (예정)'],
    summary: '[미구현] 티켓 사용 처리 (입장)',
    description:
      'QR 검증과 얼굴 인증이 **Spring 에서** 통과한 뒤 호출합니다. ' +
      '**얼굴 인증 결과나 벡터는 이 서비스로 보내지 마세요.**\n\n' +
      '`VALID → USED` 전이만 허용합니다. 요청 본문은 없습니다.\n\n' +
      PENDING_DESCRIPTION,
    security: secured,
    request: { params: z.object({ tokenId: z.string().openapi({ example: '12' }) }) },
    responses: {
      202: { description: '전송했습니다', content: { 'application/json': { schema: accepted } } },
      200: {
        description: '이미 사용된 티켓입니다. 새 tx 를 보내지 않습니다',
        content: {
          'application/json': {
            schema: z.object({
              status: z.literal('ALREADY_DONE'),
              tokenId: z.string(),
              ticketStatus,
            }),
          },
        },
      },
      409: { description: '`CANCELED` 티켓입니다 (`INVALID_TICKET_STATE`)' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/internal/tickets/{tokenId}/void',
    tags: ['티켓 (예정)'],
    summary: '[미구현] 티켓 취소',
    description:
      '**소각하지 않고 `CANCELED` 상태로 바꿉니다.** 소각하면 취소 이력이 사라집니다.\n\n' +
      '캣머니로 결제한 건은 취소가 확정된 뒤 `POST /internal/tokens/catmoney/mint` ' +
      '(`reason: REFUND`) 로 환급합니다.\n\n' +
      PENDING_DESCRIPTION,
    security: secured,
    request: { params: z.object({ tokenId: z.string().openapi({ example: '12' }) }) },
    responses: {
      202: { description: '전송했습니다', content: { 'application/json': { schema: accepted } } },
      200: {
        description: '이미 취소된 티켓입니다',
        content: {
          'application/json': {
            schema: z.object({
              status: z.literal('ALREADY_DONE'),
              tokenId: z.string(),
              ticketStatus,
            }),
          },
        },
      },
    },
  });

}
