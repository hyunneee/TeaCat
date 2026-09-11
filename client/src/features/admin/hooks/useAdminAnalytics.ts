import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { adminAnalyticsApi, adminAnalyticsKeys } from '../api/adminAnalyticsApi';
import type { TrendRange } from '../model/adminAnalytics.types';

const DEFAULT_RANGE: TrendRange = 30;

/** 대시보드 상단 카드 (Controller 레이어) */
export function useMemberSummary() {
  return useQuery({
    queryKey: adminAnalyticsKeys.summary(),
    queryFn: adminAnalyticsApi.summary,
    staleTime: STALE_TIME.SHORT,
  });
}

/**
 * 회원 추이 차트.
 *
 * 기간 선택은 **화면 상태**라 useState, 데이터는 서버 것이라 TanStack Query 가 주인입니다.
 * 기간을 바꿀 때 차트가 빈 화면으로 껌뻑이지 않도록 `keepPreviousData` 를 씁니다.
 */
export function useMemberTrend() {
  const [range, setRange] = useState<TrendRange>(DEFAULT_RANGE);

  const result = useQuery({
    queryKey: adminAnalyticsKeys.trend(range),
    queryFn: () => adminAnalyticsApi.trend(range),
    staleTime: STALE_TIME.SHORT,
    placeholderData: keepPreviousData,
  });

  return { ...result, range, setRange };
}
