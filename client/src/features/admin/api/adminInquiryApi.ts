import { http } from '@/shared/api';
import type { Inquiry, InquiryPage, InquiryStats } from '@/features/inquiry';
import type { AdminInquiryQuery } from '../model/adminInquiry.types';

/**
 * 관리자 문의 관리 API (Model 레이어).
 *
 * 🔴 전부 서버에서 ADMIN 전용입니다 (`/admin/**`). 화면은 `can.manageInquiries`
 *    로 먼저 막아야 합니다 — 안 그러면 눌렀을 때 403 나는 메뉴가 보입니다.
 */
export const adminInquiryApi = {
  list: ({ status, type, page, size }: AdminInquiryQuery) =>
    http.get<InquiryPage>('/admin/inquiries', {
      // 빈 값은 파라미터 자체를 보내지 않습니다 (axios 가 undefined 를 뺍니다)
      params: {
        status: status ?? undefined,
        type: type ?? undefined,
        page,
        size,
      },
    }),

  stats: () => http.get<InquiryStats>('/admin/inquiries/stats'),

  get: (inquiryId: number) => http.get<Inquiry>(`/admin/inquiries/${inquiryId}`),

  /** 처음 답하면 상태가 답변 완료로 넘어갑니다. 이미 답한 문의면 내용만 고칩니다 */
  answer: (inquiryId: number, answer: string) =>
    http.put<Inquiry>(`/admin/inquiries/${inquiryId}/answer`, { answer }),

  /** 답변을 등록한 뒤에만 됩니다 (서버가 409 로 막습니다) */
  resolve: (inquiryId: number) => http.post<Inquiry>(`/admin/inquiries/${inquiryId}/resolve`),

  reopen: (inquiryId: number) => http.post<Inquiry>(`/admin/inquiries/${inquiryId}/reopen`),
};

export const adminInquiryKeys = {
  all: ['admin', 'inquiries'] as const,
  list: (query: AdminInquiryQuery) => [...adminInquiryKeys.all, 'list', query] as const,
  detail: (inquiryId: number) => [...adminInquiryKeys.all, 'detail', inquiryId] as const,
  stats: () => [...adminInquiryKeys.all, 'stats'] as const,
};
