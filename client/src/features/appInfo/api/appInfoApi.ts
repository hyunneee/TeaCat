import { http } from '@/shared/api';
import type { AppVersionInfo } from '../model/appInfo.types';

/**
 * 배포 정보.
 *
 * 백엔드가 준비되면 이 엔드포인트만 맞춰주면 화면은 그대로 씁니다.
 *   GET /app/version → { latest, minimum, releasedAt, notes }
 *
 * 현재 실행 중인 버전은 서버가 알 수 없으므로 **프론트가 빌드 시점 값**을 씁니다.
 * (`env.appVersion` — .env 의 VITE_APP_VERSION)
 */
export const appInfoApi = {
  version: () => http.get<AppVersionInfo>('/app/version'),
};

export const appInfoKeys = {
  all: ['app-info'] as const,
  version: () => [...appInfoKeys.all, 'version'] as const,
};
