import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { useIsLoggedIn } from '@/features/auth';
import { inquiryApi, inquiryKeys } from '../api/inquiryApi';

const DEFAULT_SIZE = 20;

/**
 * 내 문의 목록 (Controller 레이어).
 *
 * 페이지 번호는 **화면 상태**라 useState 로 두고, 목록 자체는 서버 데이터라
 * TanStack Query 가 주인입니다 (CLAUDE.md 3-4).
 */
export function useMyInquiries() {
  const isLoggedIn = useIsLoggedIn();
  const [page, setPage] = useState(0);

  const result = useQuery({
    queryKey: inquiryKeys.list(page),
    queryFn: () => inquiryApi.list(page, DEFAULT_SIZE),
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn,
    placeholderData: keepPreviousData,
  });

  return { ...result, page, setPage };
}

export function useInquiry(inquiryId: number) {
  return useQuery({
    queryKey: inquiryKeys.detail(inquiryId),
    queryFn: () => inquiryApi.get(inquiryId),
    staleTime: STALE_TIME.SHORT,
    enabled: Number.isFinite(inquiryId),
  });
}
