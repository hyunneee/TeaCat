import type { HTMLInputTypeAttribute } from 'react';

/**
 * 회원가입 폼 규칙 (순수 모델).
 *
 * ── 왜 테이블로 두나 ───────────────────────────────────────
 * 필드를 추가하려면 **이 배열에 한 줄만** 넣으면 됩니다.
 * 화면(SignupPage)은 이 배열을 그대로 그리기만 하므로,
 * 라벨·필수 여부·글자수·검증 규칙이 한 곳에 모여 있습니다.
 *
 * ⚠️ 클라이언트 검증은 **사용자 편의**입니다. 진짜 검증은 서버가 합니다.
 *    여기 통과했다고 서버가 받아준다는 뜻이 아닙니다 (중복 아이디 등).
 */

export interface SignupForm {
  loginId: string;
  password: string;
  passwordConfirm: string;
  name: string;
  phone: string;
  email: string;
}

export type SignupErrors = Partial<Record<keyof SignupForm, string>>;

export interface SignupFieldSpec {
  name: keyof SignupForm;
  label: string;
  /** 필수 입력인가 (전화번호만 선택) */
  required: boolean;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  hint?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
  /** 브라우저가 막아주는 최대 글자수 */
  maxLength: number;
  /** 입력할 때마다 값을 다듬습니다 (공백 제거, 하이픈 자동 등) */
  format?: (value: string) => string;
  /** 통과하면 null, 아니면 사용자에게 보여줄 문구 */
  validate: (value: string, form: SignupForm) => string | null;
}

const ID_PATTERN = /^[a-zA-Z0-9]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^01[0-9]-\d{3,4}-\d{4}$/;

/** 숫자만 남겨 010-1234-5678 모양으로 */
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`;
}

export const SIGNUP_FIELDS: SignupFieldSpec[] = [
  {
    name: 'loginId',
    label: '아이디',
    required: true,
    placeholder: '영문·숫자 4~20자',
    hint: '티켓을 주고받을 때 쓰는 식별자입니다.',
    autoComplete: 'username',
    maxLength: 20,
    format: (v) => v.trim(),
    validate: (v) => {
      if (!v) return '아이디를 입력해 주세요.';
      if (v.length < 4) return '4자 이상 입력해 주세요.';
      if (!ID_PATTERN.test(v)) return '영문과 숫자만 쓸 수 있어요.';
      return null;
    },
  },
  {
    name: 'password',
    label: '비밀번호',
    required: true,
    type: 'password',
    placeholder: '영문·숫자 포함 8자 이상',
    autoComplete: 'new-password',
    maxLength: 32,
    validate: (v) => {
      if (!v) return '비밀번호를 입력해 주세요.';
      if (v.length < 8) return '8자 이상 입력해 주세요.';
      if (!/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) return '영문과 숫자를 함께 넣어 주세요.';
      return null;
    },
  },
  {
    name: 'passwordConfirm',
    label: '비밀번호 확인',
    required: true,
    type: 'password',
    autoComplete: 'new-password',
    maxLength: 32,
    validate: (v, form) => {
      if (!v) return '비밀번호를 한 번 더 입력해 주세요.';
      if (v !== form.password) return '비밀번호가 일치하지 않아요.';
      return null;
    },
  },
  {
    name: 'name',
    label: '이름',
    required: true,
    placeholder: '실명을 입력하세요',
    hint: '입장 시 신분 확인에 쓰입니다.',
    autoComplete: 'name',
    maxLength: 20,
    format: (v) => v.replace(/\s{2,}/g, ' '),
    validate: (v) => {
      if (!v.trim()) return '이름을 입력해 주세요.';
      if (v.trim().length < 2) return '2자 이상 입력해 주세요.';
      return null;
    },
  },
  {
    name: 'email',
    label: '이메일',
    required: true,
    type: 'email',
    placeholder: 'you@example.com',
    hint: '취소표 추첨 당첨 안내를 받습니다.',
    autoComplete: 'email',
    inputMode: 'email',
    maxLength: 60,
    format: (v) => v.trim(),
    validate: (v) => {
      if (!v) return '이메일을 입력해 주세요.';
      if (!EMAIL_PATTERN.test(v)) return '이메일 형식이 올바르지 않아요.';
      return null;
    },
  },
  {
    /* 유일한 선택 항목입니다. 없어도 가입은 되지만 예매 안내를 못 받습니다. */
    name: 'phone',
    label: '휴대폰 번호',
    required: false,
    placeholder: '010-0000-0000',
    hint: '입력하면 예매·입장 안내를 문자로 받습니다.',
    autoComplete: 'tel',
    inputMode: 'tel',
    maxLength: 13,
    format: formatPhone,
    validate: (v) => {
      if (!v) return null; // 선택 항목 — 비어 있어도 통과
      if (!PHONE_PATTERN.test(v)) return '010-0000-0000 형식으로 입력해 주세요.';
      return null;
    },
  },
];

export const EMPTY_SIGNUP: SignupForm = {
  loginId: '',
  password: '',
  passwordConfirm: '',
  name: '',
  phone: '',
  email: '',
};

/** 폼 전체를 검사합니다. 빈 객체면 통과. */
export function validateSignup(form: SignupForm): SignupErrors {
  const errors: SignupErrors = {};
  for (const field of SIGNUP_FIELDS) {
    const message = field.validate(form[field.name], form);
    if (message) errors[field.name] = message;
  }
  return errors;
}

export function isSignupValid(form: SignupForm): boolean {
  return Object.keys(validateSignup(form)).length === 0;
}
