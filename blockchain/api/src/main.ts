import { createApp } from './app';
import { env } from './config';
import { logger } from './shared/logger';
import { buildHealthReport } from './services/health.service';

async function main(): Promise<void> {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`blockchain api 기동 — http://localhost:${env.PORT} (${env.NODE_ENV})`);
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

  const shutdown = (signal: string): void => {
    logger.info(`${signal} 수신 — 종료합니다`);
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.error('기동 실패', error);
  process.exit(1);
});
