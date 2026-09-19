import { http } from '@/shared/api';
import type {
  AdminTradePage,
  AdminTradeQuery,
  AdminTradeReviewQuery,
  TradeReviewDetail,
  TradeReviewPage,
  TradeReviewStats,
} from '../model/adminTradeReview.types';

/**
 * 이상거래 심사 · 거래 내역 관리자 API (Model 레이어).
 *
 * 🔴 전부 서버에서 ADMIN 전용입니다 (`/admin/**`). 화면은 `can.reviewTrades` 로 먼저 막습니다.
 * 승인은 정산을 재개하고, 거절은 묶인 캣머니를 풀고 거래를 실패로 끝냅니다 — 둘 다 되돌릴 수 없습니다.
 */
export const adminTradeReviewApi = {
  list: ({ status, page, size }: AdminTradeReviewQuery) =>
    http.get<TradeReviewPage>('/admin/nft/trade-reviews', { params: { status, page, size } }),

  get: (reviewId: number) => http.get<TradeReviewDetail>(`/admin/nft/trade-reviews/${reviewId}`),

  stats: () => http.get<TradeReviewStats>('/admin/nft/trade-reviews/stats'),

  /** 거래를 정산 대기로 되돌립니다. 다음 주기에 체인 전송이 이어집니다 */
  approve: (reviewId: number, note?: string) =>
    http.post<void>(`/admin/nft/trade-reviews/${reviewId}/approve`, { note: note || undefined }),

  /** 사유는 필수입니다 (서버가 400 NFT_058 로 막습니다) */
  reject: (reviewId: number, note: string) =>
    http.post<void>(`/admin/nft/trade-reviews/${reviewId}/reject`, { note }),

  trades: ({ status, page, size }: AdminTradeQuery) =>
    http.get<AdminTradePage>('/admin/nft/trade-reviews/trades', { params: { status, page, size } }),
};

export const adminTradeReviewKeys = {
  all: ['admin', 'trade-reviews'] as const,
  list: (query: AdminTradeReviewQuery) => [...adminTradeReviewKeys.all, 'list', query] as const,
  detail: (reviewId: number) => [...adminTradeReviewKeys.all, 'detail', reviewId] as const,
  stats: () => [...adminTradeReviewKeys.all, 'stats'] as const,
  trades: (query: AdminTradeQuery) => [...adminTradeReviewKeys.all, 'trades', query] as const,
};
