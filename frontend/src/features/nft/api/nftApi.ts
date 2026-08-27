import { http } from '@/shared/api';
import type { CursorPage } from '@/shared/types';
import type { Nft, Rarity, TokenBalance } from '../model/nft.types';

export const nftApi = {
  market: (params: { rarity?: Rarity; concertId?: string }) =>
    http.get<CursorPage<Nft>>('/nfts', { params }),

  detail: (nftId: string) => http.get<Nft>(`/nfts/${nftId}`),

  mine: () => http.get<Nft[]>('/me/nfts'),

  purchase: (nftId: string) => http.post<Nft>(`/nfts/${nftId}/purchase`),

  list: (nftId: string, price: number) => http.post<Nft>(`/nfts/${nftId}/listing`, { price }),

  unlist: (nftId: string) => http.delete<Nft>(`/nfts/${nftId}/listing`),

  tokenBalance: () => http.get<TokenBalance>('/me/token'),
};

export const nftKeys = {
  all: ['nft'] as const,
  market: (rarity?: Rarity) => [...nftKeys.all, 'market', rarity ?? 'ALL'] as const,
  detail: (nftId: string) => [...nftKeys.all, 'detail', nftId] as const,
  mine: () => [...nftKeys.all, 'mine'] as const,
  token: () => ['token', 'balance'] as const,
};
