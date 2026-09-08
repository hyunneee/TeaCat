/**
 * admin feature 의 공개 API.
 *
 * 이 파일에 없는 것은 밖에서 쓸 수 없습니다 (ESLint 가 막습니다).
 *
 * 🔴 서버의 /admin/** 은 전부 ADMIN 전용입니다. 화면을 붙일 때
 *    `can.accessAdmin` / `can.manageUsers` (features/auth) 로 먼저 막으세요.
 */

// Controller
export { useAdminUsers, useAdminUserStats } from './hooks/useAdminUsers';
export { useAdminUserManagement } from './hooks/useAdminUserManagement';
export {
  useCreateAdminUser,
  useUpdateAdminUser,
  useResetAdminUserPassword,
  useDeleteAdminUserFace,
  useWithdrawAdminUser,
} from './hooks/useAdminUserMutations';

// View — 대시보드 껍데기와 벤토 그리드
export { AdminLayout } from './components/AdminLayout';
export { AdminSidebar } from './components/AdminSidebar';
export { BentoGrid, BentoTile, StatTile } from './components/BentoGrid';

// View — 회원 관리
export { AdminUserTable } from './components/AdminUserTable';
export { AdminUserToolbar, AdminPagination } from './components/AdminUserToolbar';
export { AdminUserCreateModal } from './components/AdminUserCreateModal';
export { AdminUserEditModal } from './components/AdminUserEditModal';
export { AdminPasswordResetModal } from './components/AdminPasswordResetModal';

// Model
export { adminUserApi, adminKeys } from './api/adminUserApi';
export {
  USER_ROLES,
  ROLE_LABEL,
  ROLE_DESCRIPTION,
  ROLE_OPTIONS,
  ROLE_FILTER_OPTIONS,
  PASSWORD_RULE_TEXT,
  rolesWithWallet,
  formatPhone,
  validateCreate,
  validateUpdate,
  validateNewPassword,
  diffUpdate,
  hasChanges,
  isValid,
  EMPTY_CREATE,
} from './model/adminUser.model';
export type {
  AdminUser,
  AdminUserPage,
  AdminUserStats,
  AdminUserQuery,
  AdminUserCreateRequest,
  AdminUserUpdateRequest,
} from './model/adminUser.types';
