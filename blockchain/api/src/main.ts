import { createApp } from './app';
import { env } from './config';
import { logger } from './shared/logger';
import { buildHealthReport } from './services/health.service';
import { startConfirmWatcher, stopConfirmWatcher } from './services/confirm.service';
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

  const shutdown = (signal: string): void => {
    logger.info(`${signal} 수신 — 종료합니다`);
    stopConfirmWatcher();
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
