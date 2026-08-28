import { http } from '@/shared/api';
import type { CursorPage } from '@/shared/types';
import type { Nft, Rarity, TokenBalance } from '../model/nft.types';

export const nftApi = {
  /** `q` 는 포카 이름·공연명 검색어입니다. 검색은 서버가 합니다. */
  market: (params: { rarity?: Rarity; concertId?: string; q?: string }) =>
    http.get<CursorPage<Nft>>('/nfts', { params }),

  detail: (nftId: string) => http.get<Nft>(`/nfts/${nftId}`),

  mine: () => http.get<Nft[]>('/me/nfts'),

  purchase: (nftId: string) => http.post<Nft>(`/nfts/${nftId}/purchase`),

  list: (nftId: string, body: { price: number; description?: string }) =>
    http.post<Nft>(`/nfts/${nftId}/listing`, body),

  unlist: (nftId: string) => http.delete<Nft>(`/nfts/${nftId}/listing`),

  tokenBalance: () => http.get<TokenBalance>('/me/token'),
};

export const nftKeys = {
  all: ['nft'] as const,
  market: (rarity?: Rarity, q?: string) =>
    [...nftKeys.all, 'market', rarity ?? 'ALL', q ?? ''] as const,
  detail: (nftId: string) => [...nftKeys.all, 'detail', nftId] as const,
  mine: () => [...nftKeys.all, 'mine'] as const,
  token: () => ['token', 'balance'] as const,
};
