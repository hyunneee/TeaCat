import type { Request, Response } from 'express';
import { registry } from '../metrics';

/**
 * Prometheus 스크레이프 대상. `/health` 와 같이 **인증 없이** 엽니다.
 *
 * 근거는 노출 범위입니다 — compose 가 이 서비스의 포트를 호스트로 열지 않아
 * teacat-net 안에서만 닿습니다. 인터넷에서는 nginx 를 거쳐도 도달할 수 없습니다.
 *
 * 🔴 지표에 비밀이 실리지 않는지는 라벨 설계로 지킵니다 (metrics/index.ts 주석).
 *    주소·개인키·txHash 는 라벨에 넣지 않습니다 — 여기는 로거의 마스킹이 걸리지 않는 경로입니다.
 */
export async function getMetrics(_req: Request, res: Response): Promise<void> {
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
}
