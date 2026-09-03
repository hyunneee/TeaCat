import { createApp } from './app';
import { env } from './config';
import { logger } from './shared/logger';
import { buildHealthReport } from './services/health.service';

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
