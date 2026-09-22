/**
 * admin feature 의 공개 API.
 *
 * 이 파일에 없는 것은 밖에서 쓸 수 없습니다 (ESLint 가 막습니다).
 *
 * 서버의 /admin/** 권한은 기능별로 다릅니다. 템플릿 조회·등록과 공연 풀은 PERFORMANCE도 쓰고,
 * 회원·전역 콘텐츠 관리는 ADMIN 전용입니다. 화면을 붙일 때 해당 `can.*` 정책을 확인하세요.
 */

// Controller
export { useAdminUsers, useAdminUserStats } from './hooks/useAdminUsers';
export { useAdminUserManagement } from './hooks/useAdminUserManagement';
/* 회원 상세 — 목록과 달리 "그 회원 한 명" 을 다룹니다 */
export { useAdminUserDetail, USER_DETAIL_TABS } from './hooks/useAdminUserDetail';
export type { UserDetailTab } from './hooks/useAdminUserDetail';
export {
  useAdminUserTickets,
  useAdminUserPhotocards,
  useAdminUserPhotocardPacks,
  useInvalidateAdminPhotocardPack,
  useAdminUserPurchases,
  useAdminUserSales,
} from './hooks/useAdminUserRecords';
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
/* 테스트용 캣머니 조정. 모달이 잔액 조회·조정을 직접 들고 있어 훅을 따로 내보내지
   않습니다 — 이 기능을 쓰는 화면은 회원 관리 하나뿐입니다 */
export { AdminCatMoneyModal } from './components/AdminCatMoneyModal';

// View — 회원 상세 (예매·포카 탭)
export { AdminUserProfileCard } from './components/AdminUserProfileCard';
export { AdminRecordTable } from './components/AdminRecordTable';
export { AdminUserTicketTable } from './components/AdminUserTicketTable';
export { AdminUserPhotocardTable } from './components/AdminUserPhotocardTable';
export { AdminUserPhotocardPackTable } from './components/AdminUserPhotocardPackTable';
export { AdminPackInvalidateModal } from './components/AdminPackInvalidateModal';
export { AdminUserTradeTables } from './components/AdminUserTradeTables';

// View — 문의 관리
export { AdminInquiryTable } from './components/AdminInquiryTable';
export { AdminInquiryAnswerModal } from './components/AdminInquiryAnswerModal';

// 이상거래 심사 · 거래 내역 (server/AUCTION_FRAUD_DESIGN.md)
export {
  useAdminTradeReviews,
  useAdminTrades,
  useAdminTradeReview,
  useAdminTradeReviewStats,
  useApproveTradeReview,
  useRejectTradeReview,
} from './hooks/useAdminTradeReviews';
export { AdminTradeReviewTable } from './components/AdminTradeReviewTable';
export { AdminTradeTable } from './components/AdminTradeTable';
export { AdminTradeReviewDetailModal } from './components/AdminTradeReviewDetailModal';
export { adminTradeReviewApi, adminTradeReviewKeys } from './api/adminTradeReviewApi';
export {
  RULE_LABEL,
  SEVERITY_LABEL,
  CHAIN_STATUS_LABEL,
  TRADE_FILTER_OPTIONS,
  ruleLabel,
} from './model/adminTradeReview.model';
export type {
  AdminTrade,
  AdminTradePage,
  ReviewListStatus,
  ReviewSeverity,
  TradeChainStatus,
  TradeFilter,
  TradeReviewDetail,
  TradeReviewPage,
  TradeReviewStats,
  TradeReviewSummary,
  TradeRiskSignal,
} from './model/adminTradeReview.types';

// ── 경매 관리 ──────────────────────────────────────────────
export {
  useAdminAuctions,
  useAdminAuction,
  useCancelAuction,
} from './hooks/useAdminAuctions';
export { AdminAuctionTable } from './components/AdminAuctionTable';
export { AdminAuctionDetailModal } from './components/AdminAuctionDetailModal';
export { adminAuctionApi, adminAuctionKeys } from './api/adminAuctionApi';
export {
  AUCTION_STATUS_LABEL,
  AUCTION_STATUS_TONE,
  AUCTION_STATUS_OPTIONS,
  isClosingSoon,
} from './model/adminAuction.model';
export type {
  AdminAuction,
  AdminAuctionBid,
  AdminAuctionDetail,
  AdminAuctionPage,
  AdminAuctionQuery,
  AdminAuctionStatus,
} from './model/adminAuction.types';

// View — 메인 배너 관리
export { AdminBannerFormModal } from './components/AdminBannerFormModal';
export { AdminPocaTemplateFormModal } from './components/AdminPocaTemplateFormModal';
export { AdminPocaPoolPicker } from './components/AdminPocaPoolPicker';
export { AdminPocaDesignTable } from './components/AdminPocaDesignTable';

// View — 운영 통계
// 🔴 recharts 는 어드민 전용입니다 (CLAUDE.md 1장). 차트 컴포넌트를 사용자 화면에서
//    쓰지 마세요 — 여기로 내보내는 것도 어드민 페이지가 조립할 수 있게 하기 위한 것입니다.
export { MemberTrendSection } from './components/MemberTrendSection';
export { TrendLineChart } from './components/TrendLineChart';

// Model
export { adminUserApi, adminKeys } from './api/adminUserApi';
export { adminUserRecordsApi, adminUserRecordKeys } from './api/adminUserRecordsApi';
export { adminCatMoneyApi, adminCatMoneyKeys } from './api/adminCatMoneyApi';
export type {
  AdminCatMoneyBalance,
  AdminCatMoneyAdjustResult,
  AdminCatMoneyDirection,
  AdminCatMoneyReason,
} from './model/adminCatMoney.types';
export { adminInquiryApi, adminInquiryKeys } from './api/adminInquiryApi';
export { adminBannerApi, adminBannerKeys } from './api/adminBannerApi';
export { adminPocaDesignApi, adminPocaDesignKeys } from './api/adminPocaDesignApi';
export {
  useAdminPocaTemplates,
  useCreatePocaTemplate,
  useSetTemplateHidden,
  usePerformanceDrawPool,
  useAddPerformanceDesigns,
  useAdminEventPoolDesigns,
  useAddEventPoolDesigns,
  useSetDesignDrawPool,
  useRetryDesignRegistration,
} from './hooks/useAdminPocaDesigns';
export {
  DESIGN_NAME_MAX,
  POCA_POOL_MAX_SUPPLY,
  designNameLength,
  isDrawable,
  isPerformancePoolSelectionValid,
  isPocaPoolSelectionValid,
  notYetDrawable,
  pocaPoolItems,
} from './model/adminPocaDesign.model';
export type {
  AdminPerformanceDrawPool,
  AdminPocaDesign,
  AdminPocaTemplate,
  AdminPocaTemplateCreateRequest,
  PocaDesignChainStatus,
  PocaDesignGrade,
  PocaPoolItem,
  PocaPoolSelection,
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
export type {
  AdminPhotocardPack,
  AdminPhotocardPackStatus,
} from './model/adminPhotocardPack.types';

export { AdminPackEventFormModal } from './components/AdminPackEventFormModal';
export {
  useAdminPackEvents,
  useCreatePackEvent,
  useSetPackEventActive,
} from './hooks/useAdminPackEvents';
export {
  EVENT_CODE_MAX,
  EVENT_NAME_MAX,
  normalizeEventCode,
  ongoingEvent,
  packEventState,
  type PackEventState,
} from './model/adminPackEvent.model';
export type { AdminPackEvent, AdminPackEventCreateRequest } from './model/adminPackEvent.types';
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
