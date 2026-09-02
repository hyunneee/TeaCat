import { http } from '@/shared/api';
import type { Banner } from '../model/banner.types';

export const bannerApi = {
  /** 홈 상단에 노출할 광고·이벤트 배너 */
  list: () => http.get<Banner[]>('/banners'),
};

export const bannerKeys = {
  all: ['banner'] as const,
  list: () => [...bannerKeys.all, 'list'] as const,
};
