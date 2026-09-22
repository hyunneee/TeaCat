import { http } from '@/shared/api';
import type {
  AdminAuctionDetail,
  AdminAuctionPage,
  AdminAuctionQuery,
} from '../model/adminAuction.types';

/**
 * 어드민 경매 관리 API (Model 레이어).
 *
 * 🔴 전부 서버에서 ADMIN 전용입니다(`/admin/**`). 화면은 `can.manageAuctions` 로 먼저 막습니다.
 * 🔴 강제 취소는 되돌릴 수 없습니다 — 최고 입찰자의 캣머니 담보가 풀리고 경매가 닫힙니다.
 */
export const adminAuctionApi = {
  list: ({ status, keyword, page, size }: AdminAuctionQuery) =>
    http.get<AdminAuctionPage>('/admin/nft/auctions', {
      /* 빈 문자열을 보내면 서버가 "빈 검색어" 로 받습니다. 없는 값은 아예 빼서 보냅니다 */
      params: { status: status || undefined, keyword: keyword?.trim() || undefined, page, size },
    }),

  get: (auctionId: number) => http.get<AdminAuctionDetail>(`/admin/nft/auctions/${auctionId}`),

  /** 사유는 필수입니다 (서버가 400 으로 막습니다). 서버 로그에만 남습니다 */
  cancel: (auctionId: number, reason: string) =>
    http.post<void>(`/admin/nft/auctions/${auctionId}/cancel`, { reason }),
};

export const adminAuctionKeys = {
  all: ['admin', 'auctions'] as const,
  list: (query: AdminAuctionQuery) => [...adminAuctionKeys.all, 'list', query] as const,
  detail: (auctionId: number) => [...adminAuctionKeys.all, 'detail', auctionId] as const,
};
