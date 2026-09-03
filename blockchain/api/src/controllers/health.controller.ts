import type { Request, Response } from 'express';
import { buildHealthReport } from '../services/health.service';

/**
 * 컨트롤러는 요청 검증과 응답 변환만 합니다.
 * 도메인 판단은 `services/`, 체인 접근은 `chain/` 입니다.
 */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const report = await buildHealthReport();

  // 체인이 끊겨도 프로세스는 살아 있으므로 200 으로 내리고 상태를 본문에 담습니다.
  // 오케스트레이터가 재시작해도 체인이 살아나지는 않습니다.
  res.status(200).json(report);
}
