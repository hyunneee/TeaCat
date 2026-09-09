/**
 * 문의 feature 의 공개 API.
 *
 * 관리자 쪽(목록·답변·해결)은 `features/admin` 에 있습니다 — 서버에서도
 * `/inquiries` 와 `/admin/inquiries` 로 권한이 갈리므로 화면 코드도 갈라 둡니다.
 */

// Controller
export { useMyInquiries, useInquiry } from './hooks/useInquiries';
export {
  useCreateInquiry,
  useUpdateInquiry,
  useDeleteInquiry,
} from './hooks/useInquiryMutations';

// Model
export { inquiryApi, inquiryKeys } from './api/inquiryApi';
export {
  INQUIRY_TYPES,
  TYPE_LABEL,
  TYPE_DESCRIPTION,
  STATUS_LABEL,
  STATUS_TONE,
  TITLE_MAX_LENGTH,
  CONTENT_MAX_LENGTH,
  EMPTY_INQUIRY_FORM,
  validateInquiry,
  isInquiryValid,
  type InquiryFormErrors,
} from './model/inquiry.model';
export type {
  Inquiry,
  InquirySummary,
  InquiryPage,
  InquiryStats,
  InquiryStatus,
  InquiryType,
  InquiryWriteRequest,
} from './model/inquiry.types';
