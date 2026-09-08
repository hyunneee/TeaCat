import { http } from '@/shared/api';
import type {
  AdminUser,
  AdminUserCreateRequest,
  AdminUserPage,
  AdminUserQuery,
  AdminUserStats,
  AdminUserUpdateRequest,
} from '../model/adminUser.types';

/**
 * 관리자 회원 관리 API (Model 레이어).
 *
 * 🔴 전부 서버에서 ADMIN 전용입니다 (`/admin/**`). STADIUM·PERFORMANCE 가
 *    부르면 403 이므로, 화면은 `can.manageUsers` 로 먼저 막아야 합니다.
 */
export const adminUserApi = {
  list: ({ keyword, role, page, size }: AdminUserQuery) =>
    http.get<AdminUserPage>('/admin/users', {
      // 빈 값은 파라미터 자체를 보내지 않습니다 (axios 가 undefined 를 뺍니다)
      params: {
        keyword: keyword.trim() || undefined,
        role: role ?? undefined,
        page,
        size,
      },
    }),

  stats: () => http.get<AdminUserStats>('/admin/users/stats'),

  get: (userId: number) => http.get<AdminUser>(`/admin/users/${userId}`),

  create: (body: AdminUserCreateRequest) => http.post<AdminUser>('/admin/users', body),

  update: (userId: number, body: AdminUserUpdateRequest) =>
    http.patch<AdminUser>(`/admin/users/${userId}`, body),

  resetPassword: (userId: number, newPassword: string) =>
    http.patch<void>(`/admin/users/${userId}/password`, { newPassword }),

  deleteFace: (userId: number) => http.delete<void>(`/admin/users/${userId}/face`),

  /** 탈퇴 처리 — 되돌릴 수 없습니다 (확인 모달 필수) */
  withdraw: (userId: number) => http.delete<void>(`/admin/users/${userId}`),
};

/** 쿼리 키를 문자열로 흩뿌리면 무효화할 때 반드시 사고가 납니다. */
export const adminKeys = {
  all: ['admin'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  userList: (query: AdminUserQuery) => [...adminKeys.users(), 'list', query] as const,
  user: (userId: number) => [...adminKeys.users(), 'detail', userId] as const,
  userStats: () => [...adminKeys.users(), 'stats'] as const,
};
