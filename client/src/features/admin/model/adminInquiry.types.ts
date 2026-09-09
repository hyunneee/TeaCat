import type { InquiryStatus, InquiryType } from '@/features/inquiry';

/** 목록 필터. null 이면 거르지 않습니다 */
export interface AdminInquiryQuery {
  status: InquiryStatus | null;
  type: InquiryType | null;
  page: number;
  size: number;
}
