import type { Request, Response } from 'express';
import { z } from 'zod';
import { errors } from '../shared/errors';
import {
  burnTicketById,
  findTicketByKey,
  getTicketState,
  issueTicket,
} from '../services/ticket.service';

/**
 * 컨트롤러는 요청 검증과 응답 변환만 합니다.
 *
 * 주의: 여기서 `.openapi()` 를 부르지 마세요. 그 메서드는 `docs/` 가 로드되면서
 *       zod 프로토타입에 붙는데, 컨트롤러는 라우터를 통해 **더 먼저** 로드됩니다.
 *       타입 확장은 전역이라 typecheck 는 통과하고, 서버는 기동에서 죽습니다.
 *       예시·설명은 `docs/` 쪽에서 붙입니다.
 */

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

const address = z.string().regex(ADDRESS, '0x + 40자리 hex 여야 합니다');

/**
 * Spring 이 만드는 영구 유일 키. 서버가 keccak256 으로 해싱해 온체인에 넣습니다.
 *
 * 이 값 하나가 **한 결제에 티켓 두 장이 나가는 것**을 막습니다 — 응답이 끊겨
 * Spring 이 재시도해도 컨트랙트가 두 번째를 거부합니다. (DESIGN.md 4-3)
 *
 * 주의: **비밀값을 넣으면 안 됩니다.** 해시가 체인에 영구히 남습니다.
 *       주문번호·티켓 PK 같은 식별자를 쓰세요.
 */
const ticketKey = z.string().min(1).max(200);

/**
 * tokenId 는 **정수 문자열**입니다. JSON number 로 주고받으면 큰 값에서 정밀도가
 * 깨집니다. 순번이라 지금은 작지만, 형식을 나중에 바꾸면 Spring 까지 같이 바뀝니다.
 *
 * 0 은 없습니다 — 컨트랙트가 "발행된 적 없음" 자리로 비워두고 1 부터 셉니다.
 * 상한은 uint256 의 자릿수입니다.
 */
const tokenIdString = z.string().regex(/^[1-9][0-9]{0,77}$/, '1 이상의 정수 문자열이어야 합니다');

export const issueBody = z.object({
  ticketKey,
  /**
   * 받는 주소. **반드시 `POST /internal/wallets` 가 만들어준 파생 지갑이어야 합니다.**
   *
   * 티켓은 양도할 수 없어서, 엉뚱한 주소로 발행되면 옮길 방법이 아예 없습니다.
   * 소각으로 무효화는 되지만 그건 취소지 회수가 아닙니다.
   */
  to: address,
});

export const ticketParams = z.object({ tokenId: tokenIdString });

export const ticketKeyQuery = z.object({ key: ticketKey });

/** 경로의 tokenId 를 꺼냅니다. 두 핸들러가 같은 검증을 씁니다. */
function parseTokenId(req: Request): bigint {
  const parsed = ticketParams.safeParse(req.params);
  if (!parsed.success) {
    throw errors.badRequest('tokenId 형식이 올바르지 않습니다', parsed.error.flatten());
  }
  return BigInt(parsed.data.tokenId);
}

export async function postTicketIssue(req: Request, res: Response): Promise<void> {
  const parsed = issueBody.safeParse(req.body);
  if (!parsed.success) {
    throw errors.badRequest('요청 본문이 올바르지 않습니다', parsed.error.flatten());
  }

  const result = await issueTicket(parsed.data.ticketKey, parsed.data.to);

  // 보냈으면 202, 이미 발행돼 있었으면 바뀐 게 없으니 200 입니다. (DESIGN.md 4-2)
  res.status(result.status === 'PENDING' ? 202 : 200).json(result);
}

export async function getTicket(req: Request, res: Response): Promise<void> {
  res.status(200).json(await getTicketState(parseTokenId(req)));
}

export async function getTicketByKey(req: Request, res: Response): Promise<void> {
  const parsed = ticketKeyQuery.safeParse(req.query);
  if (!parsed.success) {
    throw errors.badRequest('key 가 올바르지 않습니다', parsed.error.flatten());
  }

  // 발행 전이어도 200 입니다. 404 로 만들면 "아직 안 됨" 과 "경로가 틀림" 이 섞입니다.
  res.status(200).json(await findTicketByKey(parsed.data.key));
}

export async function postTicketBurn(req: Request, res: Response): Promise<void> {
  const result = await burnTicketById(parseTokenId(req));
  res.status(result.status === 'PENDING' ? 202 : 200).json(result);
}
