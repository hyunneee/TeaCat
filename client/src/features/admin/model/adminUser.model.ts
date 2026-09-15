import type { UserRole } from '@/features/auth';
import type { AdminUser, AdminUserCreateRequest, AdminUserUpdateRequest } from './adminUser.types';

/**
 * 회원 관리 화면의 순수 규칙 (React 를 모릅니다).
 *
 * 역할 라벨·검증 규칙을 화면마다 다시 적지 않도록 여기 모읍니다.
 */

/* ── 역할 ────────────────────────────────────────────────────
   서버 user_role ENUM 과 순서·이름이 같아야 합니다.
   역할을 추가하면 서버 enum → DB 마이그레이션 → 여기 순서로 반영하세요. */

export const USER_ROLES = ['USER', 'ADMIN', 'STADIUM', 'PERFORMANCE'] as const;

export const ROLE_LABEL: Record<UserRole, string> = {
  USER: '일반 회원',
  ADMIN: '관리자',
  STADIUM: '공연장',
  PERFORMANCE: '공연 기획',
};

/** 역할이 뭘 할 수 있는지 한 줄 설명 — 회원 생성 폼에서 잘못 고르는 걸 줄입니다 */
export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  USER: '티켓을 예매하는 일반 사용자입니다. 가입 시 지갑과 캣머니가 발급됩니다.',
  ADMIN: '모든 관리 기능을 씁니다. 회원 관리도 이 역할만 가능합니다.',
  STADIUM: '공연장 정보를 관리합니다.',
  PERFORMANCE: '공연·회차를 등록하고 관리합니다.',
};

/** 목록의 역할 필터. 맨 앞이 "전체" 라 값이 빈 문자열입니다 */
export const ROLE_FILTER_OPTIONS = [
  { value: '', label: '전체 역할' },
  ...USER_ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] })),
] as const;

export const ROLE_OPTIONS = USER_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABEL[role],
}));

/** USER 만 지갑을 받습니다 (서버 AdminUserService.create 와 같은 규칙) */
export const rolesWithWallet: readonly UserRole[] = ['USER'];

/* ── 검증 ────────────────────────────────────────────────────
   서버 DTO(AdminUserCreateRequest / AdminUserUpdateRequest)와 같은 값입니다.
   여기 통과가 서버 통과를 뜻하지는 않습니다 (중복 이메일 등). */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/* ㄱ-ㅣ 는 호환 자모(자음 ㄱ~ㅎ + 모음 ㅏ~ㅣ) 전체입니다 — "ㅎㅁ" 처럼 자음만 쓴 닉네임을
   막지 않으려고 넣었습니다. 서버의 @Pattern 과 **같은 식이어야** 합니다 (5곳). */
const NICKNAME_PATTERN = /^[ㄱ-ㅣ가-힣a-zA-Z0-9]{2,20}$/;
const PHONE_PATTERN = /^01[0-9]-\d{3,4}-\d{4}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,20}$/;

export const PASSWORD_RULE_TEXT = '영문·숫자·특수문자를 모두 포함한 8~20자';

/** 숫자만 남겨 010-1234-5678 모양으로 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`;
}

export type CreateErrors = Partial<Record<keyof AdminUserCreateRequest, string>>;
export type UpdateErrors = Partial<Record<keyof AdminUserUpdateRequest, string>>;

export const EMPTY_CREATE: AdminUserCreateRequest = {
  email: '',
  password: '',
  name: '',
  nickname: '',
  phone: '',
  role: 'USER',
};

export function validateCreate(form: AdminUserCreateRequest): CreateErrors {
  const errors: CreateErrors = {};

  if (!form.email.trim()) errors.email = '이메일을 입력해 주세요.';
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = '이메일 형식이 올바르지 않아요.';

  if (!form.password) errors.password = '비밀번호를 입력해 주세요.';
  else if (!PASSWORD_PATTERN.test(form.password))
    errors.password = `${PASSWORD_RULE_TEXT}로 만들어 주세요.`;

  if (!form.name.trim()) errors.name = '이름을 입력해 주세요.';
  else if (form.name.trim().length < 2) errors.name = '2자 이상 입력해 주세요.';

  if (!form.nickname) errors.nickname = '닉네임을 입력해 주세요.';
  else if (!NICKNAME_PATTERN.test(form.nickname))
    errors.nickname = '한글·영문·숫자 2~20자로 입력해 주세요.';

  if (!form.phone) errors.phone = '휴대폰 번호를 입력해 주세요.';
  else if (!PHONE_PATTERN.test(form.phone)) errors.phone = '010-0000-0000 형식으로 입력해 주세요.';

  return errors;
}

/** 수정 폼. 빈 값은 "그대로 둠" 이라 오류가 아닙니다 */
export function validateUpdate(form: AdminUserUpdateRequest): UpdateErrors {
  const errors: UpdateErrors = {};

  if (form.name !== undefined && form.name.trim().length > 0 && form.name.trim().length < 2) {
    errors.name = '2자 이상 입력해 주세요.';
  }
  if (form.nickname && !NICKNAME_PATTERN.test(form.nickname)) {
    errors.nickname = '한글·영문·숫자 2~20자로 입력해 주세요.';
  }
  if (form.phone && !PHONE_PATTERN.test(form.phone)) {
    errors.phone = '010-0000-0000 형식으로 입력해 주세요.';
  }

  return errors;
}

export function validateNewPassword(password: string): string | null {
  if (!password) return '새 비밀번호를 입력해 주세요.';
  if (!PASSWORD_PATTERN.test(password)) return `${PASSWORD_RULE_TEXT}로 만들어 주세요.`;
  return null;
}

export const isValid = (errors: object) => Object.keys(errors).length === 0;

/**
 * 수정 폼에서 **바뀐 값만** 골라냅니다.
 *
 * 서버는 보낸 필드만 반영하므로, 안 바뀐 필드까지 보내면 닉네임 중복 검사가
 * 자기 닉네임에 걸리는 등 불필요한 실패가 생깁니다.
 */
export function diffUpdate(
  original: AdminUser,
  form: AdminUserUpdateRequest,
): AdminUserUpdateRequest {
  const patch: AdminUserUpdateRequest = {};

  if (form.name && form.name !== original.name) patch.name = form.name.trim();
  if (form.nickname && form.nickname !== original.nickname) patch.nickname = form.nickname;
  if (form.phone && form.phone !== original.phone) patch.phone = form.phone;
  if (form.role && form.role !== original.role) patch.role = form.role;

  return patch;
}

export const hasChanges = (patch: AdminUserUpdateRequest) => Object.keys(patch).length > 0;
