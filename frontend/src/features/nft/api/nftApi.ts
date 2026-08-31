import { http } from '@/shared/api';
import type { CursorPage } from '@/shared/types';
import type { NftSort } from '../model/nft.model';
import type { Nft, NftTrade, TokenBalance } from '../model/nft.types';

export const nftApi = {
  /**
   * 마켓 목록.
   * `q` 는 포카 이름·공연명 검색어, `sort` 는 정렬 기준입니다. 둘 다 서버가 처리합니다.
   */
  market: (params: { concertId?: string; q?: string; sort?: NftSort }) =>
    http.get<CursorPage<Nft>>('/nfts', { params }),

  detail: (nftId: string) => http.get<Nft>(`/nfts/${nftId}`),

  mine: () => http.get<Nft[]>('/me/nfts'),

  /** 내 포카 거래 내역 (구매·판매 모두) */
  trades: () => http.get<NftTrade[]>('/me/nft-trades'),

  purchase: (nftId: string) => http.post<Nft>(`/nfts/${nftId}/purchase`),

  list: (nftId: string, body: { price: number; description?: string }) =>
    http.post<Nft>(`/nfts/${nftId}/listing`, body),

  unlist: (nftId: string) => http.delete<Nft>(`/nfts/${nftId}/listing`),

  tokenBalance: () => http.get<TokenBalance>('/me/token'),
};

export const nftKeys = {
  all: ['nft'] as const,
  market: (q?: string, sort?: NftSort) => [...nftKeys.all, 'market', q ?? '', sort ?? ''] as const,
  detail: (nftId: string) => [...nftKeys.all, 'detail', nftId] as const,
  mine: () => [...nftKeys.all, 'mine'] as const,
  trades: () => [...nftKeys.all, 'trades'] as const,
  token: () => ['token', 'balance'] as const,
};
