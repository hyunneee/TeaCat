import { http } from '@/shared/api';
import type { Inquiry, InquiryPage, InquiryWriteRequest } from '../model/inquiry.types';

/** 내 문의 (Model 레이어). 관리자용은 features/admin 에 따로 있습니다 */
export const inquiryApi = {
  list: (page: number, size: number) =>
    http.get<InquiryPage>('/inquiries', { params: { page, size } }),

  get: (inquiryId: number) => http.get<Inquiry>(`/inquiries/${inquiryId}`),

  create: (body: InquiryWriteRequest) => http.post<Inquiry>('/inquiries', body),

  /** 답변이 달리기 전에만 됩니다 (서버가 409 로 막습니다) */
  update: (inquiryId: number, body: InquiryWriteRequest) =>
    http.put<Inquiry>(`/inquiries/${inquiryId}`, body),

  /** 되돌릴 수 없는 동작입니다 (확인 모달 필수) */
  remove: (inquiryId: number) => http.delete<void>(`/inquiries/${inquiryId}`),
};

/** 쿼리 키를 문자열로 흩뿌리면 무효화할 때 반드시 사고가 납니다. */
export const inquiryKeys = {
  all: ['inquiry'] as const,
  list: (page: number) => [...inquiryKeys.all, 'list', page] as const,
  detail: (inquiryId: number) => [...inquiryKeys.all, 'detail', inquiryId] as const,
};
