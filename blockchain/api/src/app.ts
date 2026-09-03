import express, { type Express } from 'express';
import { router } from './routes';
import { mountDocs } from './docs';
import { requestLogger } from './middlewares/requestLogger';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

/**
 * Express 인스턴스 조립만 합니다. 서버를 띄우는 건 `main.ts` 입니다.
 * (테스트에서 포트를 열지 않고 app 만 가져다 쓸 수 있게)
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use(requestLogger);

  // 운영에서는 붙지 않습니다. 이유는 docs/index.ts.
  mountDocs(app);

  app.use(router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
