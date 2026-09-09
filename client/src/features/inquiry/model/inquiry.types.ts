/**
 * 문의 도메인 타입.
 *
 * 서버 응답 그대로입니다 (`/inquiries`, `/admin/inquiries`).
 * 필드를 바꾸려면 서버부터 바꾸세요.
 */

/** 오류 신고 · 개선 제안 · 기타 */
export type InquiryType = 'BUG' | 'IMPROVEMENT' | 'ETC';

/** 접수 → 답변 완료 → 해결. 상태를 옮기는 건 관리자뿐입니다 */
export type InquiryStatus = 'OPEN' | 'ANSWERED' | 'RESOLVED';

export interface InquirySummary {
  inquiryId: number;
  type: InquiryType;
  status: InquiryStatus;
  title: string;
  writerNickname: string;
  createdAt: string;
}

export interface Inquiry extends InquirySummary {
  content: string;
  /** 아직 답변이 없으면 null */
  answer: string | null;
  answeredByNickname: string | null;
  answeredAt: string | null;
  resolvedAt: string | null;
  /** 작성자가 수정·삭제할 수 있는지. 답변이 달리면 false 입니다 */
  editable: boolean;
}

export interface InquiryPage {
  inquiries: InquirySummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface InquiryWriteRequest {
  type: InquiryType;
  title: string;
  content: string;
}

export interface InquiryStats {
  open: number;
  answered: number;
  resolved: number;
}
