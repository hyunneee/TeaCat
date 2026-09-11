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
  useAdminInquiries,
  useAdminInquiry,
  useAdminInquiryStats,
  useAnswerInquiry,
  useResolveInquiry,
  useReopenInquiry,
} from './hooks/useAdminInquiries';
export {
  useAdminBanners,
  useCreateBanner,
  useUpdateBanner,
  useDeleteBanner,
  useReorderBanners,
  useUploadBannerImage,
} from './hooks/useAdminBanners';
export { useMemberSummary, useMemberTrend } from './hooks/useAdminAnalytics';
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

// View — 문의 관리
export { AdminInquiryTable } from './components/AdminInquiryTable';
export { AdminInquiryAnswerModal } from './components/AdminInquiryAnswerModal';

// View — 메인 배너 관리
export { AdminBannerFormModal } from './components/AdminBannerFormModal';
export { AdminPocaDesignFormModal } from './components/AdminPocaDesignFormModal';

// View — 운영 통계
// 🔴 recharts 는 어드민 전용입니다 (CLAUDE.md 1장). 차트 컴포넌트를 사용자 화면에서
//    쓰지 마세요 — 여기로 내보내는 것도 어드민 페이지가 조립할 수 있게 하기 위한 것입니다.
export { MemberTrendSection } from './components/MemberTrendSection';
export { TrendLineChart } from './components/TrendLineChart';

// Model
export { adminUserApi, adminKeys } from './api/adminUserApi';
export { adminInquiryApi, adminInquiryKeys } from './api/adminInquiryApi';
export { adminBannerApi, adminBannerKeys } from './api/adminBannerApi';
export { adminPocaDesignApi, adminPocaDesignKeys } from './api/adminPocaDesignApi';
export {
  useAdminDrawPoolDesigns,
  useCreatePocaDesign,
  useRetryDesignRegistration,
} from './hooks/useAdminPocaDesigns';
export type {
  AdminPocaDesign,
  AdminPocaDesignCreateRequest,
  PocaDesignChainStatus,
  PocaDesignGrade,
} from './model/adminPocaDesign.types';
export { adminAnalyticsApi, adminAnalyticsKeys } from './api/adminAnalyticsApi';
export {
  TREND_RANGES,
  TREND_RANGE_LABEL,
  type MemberSummary,
  type MemberTrend,
  type MemberDailyPoint,
  type DeploymentMarker,
  type TrendRange,
} from './model/adminAnalytics.types';
export type {
  AdminBanner,
  AdminBannerType,
  AdminBannerWriteRequest,
  BannerUploadUrl,
} from './model/adminBanner.types';
export type { AdminInquiryQuery } from './model/adminInquiry.types';
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
