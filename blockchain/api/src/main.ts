import { createApp } from './app';
import { env } from './config';
import { logger } from './shared/logger';
import { buildHealthReport } from './services/health.service';
import { startConfirmWatcher, stopConfirmWatcher } from './services/confirm.service';
import { startDrawWatcher, stopDrawWatcher } from './services/drawWatcher.service';
import {
  startPhotocardConfirmWatcher,
  stopPhotocardConfirmWatcher,
} from './services/photocardConfirm.service';
import { closePool } from './db/pool';

async function main(): Promise<void> {
  const app = createApp();

  /* 기본은 루프백입니다. 이 프로세스는 오퍼레이터 개인키와 마스터 니모닉을 쥐고 있어서,
     실수로 사설망·공인 IP 에 열리면 안 됩니다. 컨테이너처럼 외부에서 붙어야 하는
     환경에서만 HOST 로 넓히고, 그때도 앞단에서 접근을 막으세요. (DESIGN.md 1장) */
  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`blockchain api 기동 — http://${env.HOST}:${env.PORT} (${env.NODE_ENV})`);
    logger.info(`tx sender: ${env.TX_SENDER}`);
  });

  // 기동 직후 체인 상태를 한 번 찍어줍니다.
  // 여기서 경고가 보이면 `npm run chain` 이 안 떠 있는 겁니다.
  const report = await buildHealthReport();
  if (report.chain.connected) {
    logger.info(
      `체인 연결됨 — chainId ${report.chain.actualChainId}, block ${report.chain.blockNumber}`,
    );
    logger.info(`operator ${report.operator.address} — ${report.operator.balanceEth} ETH`);
  }
  for (const warning of report.warnings) {
    logger.warn(warning);
  }

  /* 확정 감시. 블록이 10초라, 쓰기는 202 로 끝내고 여기서 결과를 기다립니다.
     Spring 은 폴링하지 않고 tickets 행이 갱신되는 걸로 압니다. (DESIGN.md 1장 예외) */
  const missing = await startConfirmWatcher();
  if (missing.length > 0) {
    /* 컬럼이 없으면 첫 티켓 발행 때 조용히 깨집니다. 그때는 이미 유저가 결제를
       끝낸 뒤라, 부팅에서 죽는 편이 낫습니다. */
    logger.error('Spring DB 스키마가 맞지 않아 기동을 중단합니다');
    server.close();
    await closePool();
    process.exit(1);
  }

  /* 포토카드 확정 감시. 티켓과 같은 구조인데 한 트랜잭션이 카드 200장을 실어
     나릅니다. 컬럼이 없으면 공연 하나치 발행이 조용히 깨지므로 여기서 죽습니다. */
  const missingPhotocard = await startPhotocardConfirmWatcher();
  if (missingPhotocard.length > 0) {
    logger.error('nft_photocards 스키마가 맞지 않아 기동을 중단합니다');
    server.close();
    await closePool();
    process.exit(1);
  }

  /* 자동 리빌. 블록해시가 256블록(약 42분)만 남아서, 커밋한 추첨을 그 안에
     공개하지 못하면 되살릴 수 없습니다. 사람 손에 맡기지 않습니다.
     (PHOTOCARD_PLAN.md 4-8)

     DB 를 보지 않습니다 — 창이 곧 봐야 할 범위라, 최근 256블록의 로그만 훑으면
     복구할 것이 전부 나옵니다. */
  startDrawWatcher();

  const shutdown = (signal: string): void => {
    logger.info(`${signal} 수신 — 종료합니다`);
    stopConfirmWatcher();
    stopPhotocardConfirmWatcher();
    stopDrawWatcher();
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.error('기동 실패', error);
  process.exit(1);
});
