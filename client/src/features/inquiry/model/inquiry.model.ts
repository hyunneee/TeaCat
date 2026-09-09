import type { InquiryStatus, InquiryType, InquiryWriteRequest } from './inquiry.types';

/**
 * 문의 폼 규칙과 표시 라벨 (순수 모델).
 *
 * ⚠️ 클라이언트 검증은 **사용자 편의**입니다. 진짜 검증은 서버가 합니다.
 *    글자수 상한은 서버(InquiryCreateRequest)와 같은 값으로 맞춰 둡니다.
 */

export const TITLE_MAX_LENGTH = 100;
export const CONTENT_MAX_LENGTH = 2000;

export const INQUIRY_TYPES: InquiryType[] = ['BUG', 'IMPROVEMENT', 'ETC'];

export const TYPE_LABEL: Record<InquiryType, string> = {
  BUG: '오류',
  IMPROVEMENT: '개선',
  ETC: '기타',
};

export const TYPE_DESCRIPTION: Record<InquiryType, string> = {
  BUG: '동작하지 않거나 이상하게 나오는 것',
  IMPROVEMENT: '이렇게 바뀌면 좋겠다는 제안',
  ETC: '그 밖의 문의',
};

export const STATUS_LABEL: Record<InquiryStatus, string> = {
  OPEN: '답변 대기',
  ANSWERED: '답변 완료',
  RESOLVED: '해결',
};

/**
 * 상태 색.
 *
 * 해결은 초록(success)이 아니라 조용한 회색입니다 — 초록은 "지금 눌러야 할 것"에만
 * 쓰는 강조색이고(DESIGN.md 1장), 끝난 일은 눈에 띌 필요가 없습니다.
 */
export const STATUS_TONE: Record<InquiryStatus, 'warning' | 'info' | 'quiet'> = {
  OPEN: 'warning',
  ANSWERED: 'info',
  RESOLVED: 'quiet',
};

export type InquiryFormErrors = Partial<Record<'title' | 'content', string>>;

export const EMPTY_INQUIRY_FORM: InquiryWriteRequest = {
  type: 'BUG',
  title: '',
  content: '',
};

export function validateInquiry(form: InquiryWriteRequest): InquiryFormErrors {
  const errors: InquiryFormErrors = {};

  if (!form.title.trim()) errors.title = '제목을 입력해 주세요.';
  else if (form.title.length > TITLE_MAX_LENGTH) errors.title = `제목은 ${TITLE_MAX_LENGTH}자까지 쓸 수 있어요.`;

  if (!form.content.trim()) errors.content = '내용을 입력해 주세요.';
  else if (form.content.length > CONTENT_MAX_LENGTH)
    errors.content = `내용은 ${CONTENT_MAX_LENGTH}자까지 쓸 수 있어요.`;

  return errors;
}

export function isInquiryValid(form: InquiryWriteRequest): boolean {
  return Object.keys(validateInquiry(form)).length === 0;
}
