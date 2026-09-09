import { http } from '@/shared/api';
import type { MemberSummary, MemberTrend, TrendRange } from '../model/adminAnalytics.types';

/**
 * 운영 통계 API (Model 레이어).
 *
 * 🔴 서버에서 ADMIN 전용입니다 (`/admin/**`). 화면은 `can.viewAnalytics` 로 먼저 막습니다.
 *
 * 🔴 기간은 시작일·종료일이 아니라 **일수**로 보냅니다. 브라우저의 "오늘" 은 그 PC 의
 *    시간대·시계라, 서버가 아는 오늘과 하루 어긋날 수 있습니다. 오늘이 언제인지는
 *    서버가 정하고 응답의 `from`·`to` 로 알려줍니다.
 */
export const adminAnalyticsApi = {
  summary: () => http.get<MemberSummary>('/admin/analytics/members/summary'),

  trend: (days: TrendRange) =>
    http.get<MemberTrend>('/admin/analytics/members', { params: { days } }),
};

export const adminAnalyticsKeys = {
  all: ['admin', 'analytics'] as const,
  summary: () => [...adminAnalyticsKeys.all, 'summary'] as const,
  trend: (days: TrendRange) => [...adminAnalyticsKeys.all, 'trend', days] as const,
};
