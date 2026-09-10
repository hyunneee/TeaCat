import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { STALE_TIME } from '@/shared/constants';
import { inquiryKeys, type InquiryStatus, type InquiryType } from '@/features/inquiry';
import { adminInquiryApi, adminInquiryKeys } from '../api/adminInquiryApi';
import type { AdminInquiryQuery } from '../model/adminInquiry.types';

const DEFAULT_SIZE = 20;

const message = (error: unknown, fallback: string) =>
  ApiError.isApiError(error) ? error.message : fallback;

/**
 * 문의 목록 (Controller 레이어).
 *
 * 필터·페이지는 **화면 상태**라 useState, 목록은 서버 데이터라 TanStack Query 가 주인입니다.
 * 페이지를 넘길 때 표가 비워지지 않도록 `keepPreviousData` 를 씁니다.
 */
export function useAdminInquiries() {
  const [status, setStatus] = useState<InquiryStatus | null>(null);
  const [type, setType] = useState<InquiryType | null>(null);
  const [page, setPage] = useState(0);

  const query: AdminInquiryQuery = useMemo(
    () => ({ status, type, page, size: DEFAULT_SIZE }),
    [status, type, page],
  );

  const result = useQuery({
    queryKey: adminInquiryKeys.list(query),
    queryFn: () => adminInquiryApi.list(query),
    staleTime: STALE_TIME.SHORT,
    placeholderData: keepPreviousData,
  });

  /* 필터를 바꾸면 페이지를 0 으로 되돌립니다.
     3페이지를 보다 필터를 걸면 결과가 1페이지뿐이라 빈 표가 나옵니다. */
  const filterStatus = (next: InquiryStatus | null) => {
    setStatus(next);
    setPage(0);
  };

  const filterType = (next: InquiryType | null) => {
    setType(next);
    setPage(0);
  };

  return { ...result, query, status, type, page, filterStatus, filterType, setPage };
}

export function useAdminInquiryStats() {
  return useQuery({
    queryKey: adminInquiryKeys.stats(),
    queryFn: adminInquiryApi.stats,
    staleTime: STALE_TIME.SHORT,
  });
}

export function useAdminInquiry(inquiryId: number | null) {
  return useQuery({
    queryKey: adminInquiryKeys.detail(inquiryId ?? 0),
    queryFn: () => adminInquiryApi.get(inquiryId as number),
    staleTime: STALE_TIME.SHORT,
    enabled: inquiryId !== null,
  });
}

/**
 * 목록·현황·상세를 한 번에 다시 읽습니다.
 *
 * 답변 하나로 상태와 집계가 같이 바뀌므로 따로 무효화하면 화면마다 값이 어긋납니다.
 * 작성자가 보는 화면(`inquiryKeys`)도 같은 데이터라 함께 털어냅니다.
 */
function invalidateInquiries() {
  void queryClient.invalidateQueries({ queryKey: adminInquiryKeys.all });
  void queryClient.invalidateQueries({ queryKey: inquiryKeys.all });
}

export function useAnswerInquiry() {
  return useMutation({
    mutationFn: ({ inquiryId, answer }: { inquiryId: number; answer: string }) =>
      adminInquiryApi.answer(inquiryId, answer),
    onSuccess: () => {
      invalidateInquiries();
      toast.success('답변을 등록했어요.');
    },
    onError: (error) => toast.error(message(error, '답변을 등록하지 못했어요.')),
  });
}

export function useResolveInquiry() {
  return useMutation({
    mutationFn: (inquiryId: number) => adminInquiryApi.resolve(inquiryId),
    onSuccess: () => {
      invalidateInquiries();
      toast.success('해결 처리했어요.');
    },
    onError: (error) => toast.error(message(error, '해결 처리하지 못했어요.')),
  });
}

export function useReopenInquiry() {
  return useMutation({
    mutationFn: (inquiryId: number) => adminInquiryApi.reopen(inquiryId),
    onSuccess: () => {
      invalidateInquiries();
      toast.info('해결 처리를 취소했어요.');
    },
    onError: (error) => toast.error(message(error, '해결 처리를 취소하지 못했어요.')),
  });
}
