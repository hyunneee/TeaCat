import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { STALE_TIME } from '@/shared/constants';
import { adminAuctionApi, adminAuctionKeys } from '../api/adminAuctionApi';
import type { AdminAuctionQuery, AdminAuctionStatus } from '../model/adminAuction.types';

const DEFAULT_SIZE = 20;

const message = (error: unknown, fallback: string) =>
  ApiError.isApiError(error) ? error.message : fallback;

/**
 * 경매 목록 (Controller 레이어).
 *
 * 상태 필터·검색어·페이지는 **화면 상태**라 useState, 목록은 서버 데이터라 TanStack Query 가
 * 주인입니다 (CLAUDE.md 3-4).
 *
 * 🔴 필터나 검색어를 바꾸면 페이지를 0 으로 되돌립니다 — 3페이지를 보다 필터를 좁히면
 * 빈 표가 나오고, 어드민은 "결과가 없다" 로 읽습니다.
 */
export function useAdminAuctions() {
  const [status, setStatus] = useState<AdminAuctionStatus | ''>('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);

  const query: AdminAuctionQuery = useMemo(
    () => ({ status: status || undefined, keyword: keyword.trim() || undefined, page, size: DEFAULT_SIZE }),
    [status, keyword, page],
  );

  const result = useQuery({
    queryKey: adminAuctionKeys.list(query),
    queryFn: () => adminAuctionApi.list(query),
    staleTime: STALE_TIME.SHORT,
    /* 페이지를 넘길 때 표가 빈 화면으로 한 번 껌뻑이지 않게 이전 페이지를 들고 있습니다 */
    placeholderData: keepPreviousData,
  });

  const filterStatus = (next: AdminAuctionStatus | '') => {
    setStatus(next);
    setPage(0);
  };

  const search = (next: string) => {
    setKeyword(next);
    setPage(0);
  };

  return { ...result, query, status, keyword, page, filterStatus, search, setPage };
}

/** 경매 상세 — 입찰 이력까지 한 응답에 옵니다. `auctionId` 가 null 이면 부르지 않습니다 */
export function useAdminAuction(auctionId: number | null) {
  return useQuery({
    queryKey: adminAuctionKeys.detail(auctionId ?? 0),
    queryFn: () => adminAuctionApi.get(auctionId as number),
    staleTime: STALE_TIME.SHORT,
    enabled: auctionId !== null,
  });
}

/**
 * 강제 취소.
 *
 * 🔴 목록과 상세를 **둘 다** 갱신합니다. 상세만 갱신하면 모달을 닫았을 때 표에 여전히
 * "진행 중" 으로 남아 있어서, 어드민이 취소가 안 된 줄 알고 한 번 더 누릅니다.
 */
export function useCancelAuction() {
  return useMutation({
    mutationFn: ({ auctionId, reason }: { auctionId: number; reason: string }) =>
      adminAuctionApi.cancel(auctionId, reason),
    /* 되돌릴 수 없는 동작이라 재시도하지 않습니다 — 같은 취소를 두 번 보내지 않습니다 */
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminAuctionKeys.all });
      toast.success('경매를 취소했어요. 입찰자의 캣머니가 풀려요.');
    },
    onError: (error) => toast.error(message(error, '경매를 취소하지 못했어요.')),
  });
}
