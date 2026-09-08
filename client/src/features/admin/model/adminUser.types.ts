import type { UserRole } from '@/features/auth';

/** 서버 `AdminUserResponse` 그대로입니다. 필드를 바꾸려면 서버부터 바꾸세요. */
export interface AdminUser {
  userId: number;
  /** 로그인 아이디입니다. 수정할 수 없습니다 (SSAFY 계정 연결의 기준값) */
  email: string;
  name: string;
  nickname: string;
  phone: string;
  role: UserRole;
  faceRegistered: boolean;
  /** 비밀번호 없이 SSAFY 계정으로만 로그인하는 회원 — 비밀번호 초기화 대상이 아닙니다 */
  socialOnly: boolean;
  createdAt: string;
}

/** 서버 `AdminUserPageResponse`. 커서가 아니라 페이지 번호입니다 */
export interface AdminUserPage {
  users: AdminUser[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AdminUserStats {
  total: number;
  /** 0 명인 역할도 키가 있습니다 — 서버가 채워서 줍니다 */
  byRole: Record<UserRole, number>;
  faceRegistered: number;
  joinedLast7Days: number;
}

/** 목록 조회 조건. 그대로 쿼리 키에 들어갑니다 */
export interface AdminUserQuery {
  keyword: string;
  /** null 이면 전체 역할 */
  role: UserRole | null;
  page: number;
  size: number;
}

export interface AdminUserCreateRequest {
  email: string;
  password: string;
  name: string;
  nickname: string;
  phone: string;
  role: UserRole;
}

/** 보낸 필드만 바뀝니다. 빈 값은 보내지 않습니다 */
export interface AdminUserUpdateRequest {
  name?: string;
  nickname?: string;
  phone?: string;
  role?: UserRole;
}
