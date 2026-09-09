import { http } from '@/shared/api';
import type { Banner } from '../model/banner.types';

export const bannerApi = {
  /** 홈 상단에 노출할 배너. 비로그인도 볼 수 있습니다 */
  list: () => http.get<Banner[]>('/banners'),
};

export const bannerKeys = {
  all: ['banner'] as const,
  list: () => [...bannerKeys.all, 'list'] as const,
};
