import { http } from '@/shared/api';
import type { PopularConcert, PopularPhotocard } from '../model/ranking.types';

export const rankingApi = {
  concerts: () => http.get<PopularConcert[]>('/rankings/concerts'),
  photocards: () => http.get<PopularPhotocard[]>('/rankings/photocards'),
};

export const rankingKeys = {
  all: ['rankings'] as const,
  concerts: ['rankings', 'concerts'] as const,
  photocards: ['rankings', 'photocards'] as const,
};
