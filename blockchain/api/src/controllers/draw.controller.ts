import type { Request, Response } from 'express';
import { z } from 'zod';
import { errors } from '../shared/errors';
import { assignFor, getDrawState, openDrawFor, revealDrawFor } from '../services/draw.service';

/**
 * 컨트롤러는 요청 검증과 응답 변환만 합니다.
 *
 * 주의: 여기서 `.openapi()` 를 부르지 마세요 — `docs/` 보다 먼저 로드되어 서버가
 *       기동에서 죽습니다. 예시·설명은 `docs/` 쪽에서 붙입니다.
 */

const numericId = z.string().regex(/^[1-9][0-9]{0,77}$/, '1 이상의 정수 문자열이어야 합니다');

/**
 * Spring 이 만드는 영구 유일 키.
 *
 * **`performanceId` 를 넣으세요.** 같은 공연에 추첨이 몇 번 열렸는지가 눈에 띄어야
 * 합니다 — 재추첨을 막지는 못하고 **기록으로 남기는 것**이 이 설계의 마지막
 * 방어선입니다. (PHOTOCARD_PLAN.md 4-9)
 */
const drawKey = z.string().min(1).max(200);

/**
 * 추첨에 커밋되는 입력. **순서까지 의미가 있습니다.**
 *
 * 오름차순 검사는 서비스가 합니다 — 순서가 어긋난 채로 커밋되면 배정 단계에서
 * 해시가 안 맞고, 그때는 이미 커밋 트랜잭션이 체인에 남아 그 추첨을 버려야 합니다.
 */
const drawInputs = z.object({
  performanceId: numericId,
  ticketIds: z.array(numericId).min(1).max(5000),
  designIds: z.array(numericId).min(1).max(200),
  quantities: z.array(numericId).min(1).max(200),
});

export const openBody = drawInputs.extend({ drawKey });
export const drawParams = z.object({ drawKey });
export const assignBody = drawInputs;

function parseDrawKey(req: Request): string {
  const parsed = drawParams.safeParse(req.params);
  if (!parsed.success) {
    throw errors.badRequest('drawKey 가 올바르지 않습니다', parsed.error.flatten());
  }
  return parsed.data.drawKey;
}

export async function postDrawOpen(req: Request, res: Response): Promise<void> {
  const parsed = openBody.safeParse(req.body);
  if (!parsed.success) {
    throw errors.badRequest('요청 본문이 올바르지 않습니다', parsed.error.flatten());
  }

  const { drawKey: key, ...inputs } = parsed.data;
  res.status(202).json(await openDrawFor(key, inputs));
}

/**
 * 수동 공개.
 *
 * **보통은 감시가 자동으로 부릅니다** (`drawWatcher.service`). 42분 시한을 사람 손에
 * 맡기지 않기 위해서입니다. 이 경로는 감시가 죽어 있거나 즉시 확정해야 할 때 씁니다.
 */
export async function postDrawReveal(req: Request, res: Response): Promise<void> {
  res.status(202).json(await revealDrawFor(parseDrawKey(req)));
}

export async function getDraw(req: Request, res: Response): Promise<void> {
  // 열린 적 없어도 200 입니다. exists 로 구분합니다.
  res.status(200).json(await getDrawState(parseDrawKey(req)));
}

export async function postDrawAssign(req: Request, res: Response): Promise<void> {
  const parsed = assignBody.safeParse(req.body);
  if (!parsed.success) {
    throw errors.badRequest('요청 본문이 올바르지 않습니다', parsed.error.flatten());
  }

  // 트랜잭션이 없습니다. 확정된 난수로 도는 계산이라 200 입니다.
  res.status(200).json(await assignFor(parseDrawKey(req), parsed.data));
}
