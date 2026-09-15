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
 *    여기 통과했다고 서버가 받아준다는 뜻이 아닙니다 (중복 이메일 등).
 *    규칙은 서버(SignupRequest)의 제약과 같은 값으로 맞춰 둡니다.
 */

export interface SignupForm {
  email: string;
  password: string;
  passwordConfirm: string;
  name: string;
  nickname: string;
  phone: string;
}

export type SignupErrors = Partial<Record<keyof SignupForm, string>>;

export interface SignupFieldSpec {
  name: keyof SignupForm;
  label: string;
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

/** 서버와 같은 규칙입니다 (SignupRequest) */
/* ㄱ-ㅣ 는 호환 자모(자음 ㄱ~ㅎ + 모음 ㅏ~ㅣ) 전체입니다 — "ㅎㅁ" 처럼 자음만 쓴 닉네임을
   막지 않으려고 넣었습니다. 서버의 @Pattern 과 **같은 식이어야** 합니다 (5곳). */
const NICKNAME_PATTERN = /^[ㄱ-ㅣ가-힣a-zA-Z0-9]{2,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^01[0-9]-\d{3,4}-\d{4}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,20}$/;

/** 숫자만 남겨 010-1234-5678 모양으로 */
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`;
}

export const SIGNUP_FIELDS: SignupFieldSpec[] = [
  {
    name: 'email',
    label: '이메일',
    required: true,
    type: 'email',
    placeholder: 'you@example.com',
    hint: '로그인할 때 쓰는 아이디입니다.',
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
    name: 'password',
    label: '비밀번호',
    required: true,
    type: 'password',
    placeholder: '영문·숫자·특수문자 포함 8~20자',
    autoComplete: 'new-password',
    maxLength: 20,
    validate: (v) => {
      if (!v) return '비밀번호를 입력해 주세요.';
      if (!PASSWORD_PATTERN.test(v)) return '영문·숫자·특수문자를 모두 넣어 8~20자로 만들어 주세요.';
      return null;
    },
  },
  {
    name: 'passwordConfirm',
    label: '비밀번호 확인',
    required: true,
    type: 'password',
    autoComplete: 'new-password',
    maxLength: 20,
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
    name: 'nickname',
    label: '닉네임',
    required: true,
    placeholder: '한글·영문·숫자 2~20자',
    hint: '티켓을 주고받을 때 쓰는 이름입니다.',
    autoComplete: 'nickname',
    maxLength: 20,
    format: (v) => v.trim(),
    validate: (v) => {
      if (!v) return '닉네임을 입력해 주세요.';
      if (!NICKNAME_PATTERN.test(v)) return '한글·영문·숫자 2~20자로 입력해 주세요.';
      return null;
    },
  },
  {
    name: 'phone',
    label: '휴대폰 번호',
    required: true,
    placeholder: '010-0000-0000',
    hint: '예매·입장 안내를 문자로 받습니다.',
    autoComplete: 'tel',
    inputMode: 'tel',
    maxLength: 13,
    format: formatPhone,
    validate: (v) => {
      if (!v) return '휴대폰 번호를 입력해 주세요.';
      if (!PHONE_PATTERN.test(v)) return '010-0000-0000 형식으로 입력해 주세요.';
      return null;
    },
  },
];

export const EMPTY_SIGNUP: SignupForm = {
  email: '',
  password: '',
  passwordConfirm: '',
  name: '',
  nickname: '',
  phone: '',
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

/* ── SSAFY 가입 추가정보 ───────────────────────────────────
   SSAFY 가 이메일과 비밀번호를 대신하므로 나머지만 받습니다.
   검증 규칙을 두 벌 적지 않도록 위 테이블을 그대로 재사용합니다. */

const OAUTH_SIGNUP_FIELD_NAMES = ['name', 'nickname', 'phone'] as const;

export type OauthSignupForm = Pick<SignupForm, (typeof OAUTH_SIGNUP_FIELD_NAMES)[number]>;
export type OauthSignupErrors = Partial<Record<keyof OauthSignupForm, string>>;

export const OAUTH_SIGNUP_FIELDS: SignupFieldSpec[] = SIGNUP_FIELDS.filter((field) =>
  (OAUTH_SIGNUP_FIELD_NAMES as readonly string[]).includes(field.name),
);

export const EMPTY_OAUTH_SIGNUP: OauthSignupForm = { name: '', nickname: '', phone: '' };

export function validateOauthSignup(form: OauthSignupForm): OauthSignupErrors {
  const full: SignupForm = { ...EMPTY_SIGNUP, ...form };
  const errors: OauthSignupErrors = {};

  for (const field of OAUTH_SIGNUP_FIELDS) {
    const key = field.name as keyof OauthSignupForm;
    const message = field.validate(full[key], full);
    if (message) errors[key] = message;
  }

  return errors;
}

export function isOauthSignupValid(form: OauthSignupForm): boolean {
  return Object.keys(validateOauthSignup(form)).length === 0;
}
