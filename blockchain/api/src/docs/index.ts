import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { env } from '../config';
import { logger } from '../shared/logger';
import { buildOpenApiDocument } from './openapi';

/** Swagger UI 와 원본 문서를 여는 경로 */
export const DOCS_PATH = '/docs';
export const DOCS_JSON_PATH = '/docs.json';

/**
 * API 문서를 붙입니다.
 *
 * **운영에서는 열지 않습니다.** 이 프로세스는 오퍼레이터 개인키와 마스터 니모닉을
 * 쥐고 있습니다. 내부 API 의 생김새를 밖에 광고할 이유가 없습니다 (DESIGN.md 1장).
 * 운영에서도 봐야 한다면 리버스 프록시에서 사내망으로만 열어주세요.
 *
 * `x-internal-key` 를 Swagger UI 의 Authorize 에 넣으면 화면에서 바로 호출됩니다.
 */
export function mountDocs(app: Express): void {
  if (env.NODE_ENV === 'production') return;

  const document = buildOpenApiDocument();

  // 원본 JSON. Postman 으로 가져가거나 클라이언트 코드 생성에 씁니다.
  app.get(DOCS_JSON_PATH, (_req, res) => {
    res.json(document);
  });

  app.use(
    DOCS_PATH,
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: '티캣 블록체인 내부 API',
      swaggerOptions: {
        // 끕니다. 켜면 내부 API 키가 브라우저 저장소에 남아, 그 브라우저를
        // 쓰는 사람 누구나 꺼내 볼 수 있습니다. 새로고침마다 다시 넣는 편이 낫습니다.
        persistAuthorization: false,
        displayRequestDuration: true,
      },
    }),
  );

  logger.info(`API 문서 — http://localhost:${env.PORT}${DOCS_PATH}`);
}
