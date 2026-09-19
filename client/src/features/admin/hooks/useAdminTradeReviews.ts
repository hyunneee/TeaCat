import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { STALE_TIME } from '@/shared/constants';
import { adminTradeReviewApi, adminTradeReviewKeys } from '../api/adminTradeReviewApi';
import type {
  AdminTradeQuery,
  AdminTradeReviewQuery,
  ReviewListStatus,
  TradeFilter,
} from '../model/adminTradeReview.types';

const DEFAULT_SIZE = 20;

const message = (error: unknown, fallback: string) =>
  ApiError.isApiError(error) ? error.message : fallback;

/**
 * 심사 목록 (Controller 레이어).
 *
 * 탭·페이지는 **화면 상태**라 useState, 목록은 서버 데이터라 TanStack Query 가 주인입니다.
 * 탭을 바꾸면 페이지를 0 으로 되돌립니다 — 3페이지를 보다 탭을 바꾸면 빈 표가 나옵니다.
 */
export function useAdminTradeReviews() {
  const [status, setStatus] = useState<ReviewListStatus>('OPEN');
  const [page, setPage] = useState(0);

  const query: AdminTradeReviewQuery = useMemo(
    () => ({ status, page, size: DEFAULT_SIZE }),
    [status, page],
  );

  const result = useQuery({
    queryKey: adminTradeReviewKeys.list(query),
    queryFn: () => adminTradeReviewApi.list(query),
    staleTime: STALE_TIME.SHORT,
    placeholderData: keepPreviousData,
  });

  const filterStatus = (next: ReviewListStatus) => {
    setStatus(next);
    setPage(0);
  };

  return { ...result, query, status, page, filterStatus, setPage };
}

/** 전체 거래 내역 — 심사와 무관한 거래까지 한 표로 */
export function useAdminTrades() {
  const [status, setStatus] = useState<TradeFilter>('ALL');
  const [page, setPage] = useState(0);

  const query: AdminTradeQuery = useMemo(() => ({ status, page, size: DEFAULT_SIZE }), [status, page]);

  const result = useQuery({
    queryKey: adminTradeReviewKeys.trades(query),
    queryFn: () => adminTradeReviewApi.trades(query),
    staleTime: STALE_TIME.SHORT,
    placeholderData: keepPreviousData,
  });

  const filterStatus = (next: TradeFilter) => {
    setStatus(next);
    setPage(0);
  };

  return { ...result, query, status, page, filterStatus, setPage };
}

export function useAdminTradeReviewStats() {
  return useQuery({
    queryKey: adminTradeReviewKeys.stats(),
    queryFn: adminTradeReviewApi.stats,
    staleTime: STALE_TIME.SHORT,
  });
}

export function useAdminTradeReview(reviewId: number | null) {
  return useQuery({
    queryKey: adminTradeReviewKeys.detail(reviewId ?? 0),
    queryFn: () => adminTradeReviewApi.get(reviewId as number),
    staleTime: STALE_TIME.SHORT,
    enabled: reviewId !== null,
  });
}

/**
 * 결정 하나로 심사 목록·거래 내역·통계·상세가 함께 바뀝니다. 따로 무효화하면 표마다 값이 어긋납니다.
 */
function invalidateReviews() {
  void queryClient.invalidateQueries({ queryKey: adminTradeReviewKeys.all });
}

export function useApproveTradeReview() {
  return useMutation({
    mutationFn: ({ reviewId, note }: { reviewId: number; note?: string }) =>
      adminTradeReviewApi.approve(reviewId, note),
    onSuccess: () => {
      invalidateReviews();
      toast.success('승인했어요. 다음 주기에 정산이 이어져요.');
    },
    onError: (error) => toast.error(message(error, '승인하지 못했어요.')),
  });
}

export function useRejectTradeReview() {
  return useMutation({
    mutationFn: ({ reviewId, note }: { reviewId: number; note: string }) =>
      adminTradeReviewApi.reject(reviewId, note),
    onSuccess: () => {
      invalidateReviews();
      toast.success('거절했어요. 묶인 캣머니가 풀려요.');
    },
    onError: (error) => toast.error(message(error, '거절하지 못했어요.')),
  });
}
