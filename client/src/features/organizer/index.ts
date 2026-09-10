/**
 * organizer feature 의 공개 API — 공연 관리(등록·수정·삭제·회차·구역 가격·노출).
 * 관리자 API(`/admin/concerts/**` 등)는 서버에서 ADMIN·PERFORMANCE 역할만 허용합니다.
 */

// Controller
export {
  useCreateConcert,
  useUpdateConcert,
  useDeleteConcert,
  useStadiums,
} from './hooks/useCreateConcert';
export {
  useAddSchedule,
  useDeleteSchedule,
  useGenerateSeats,
} from './hooks/useManageSchedules';
export { useMyConcerts, useMyConcert, useSetVisibility } from './hooks/useMyConcerts';
export {
  useStadiumLayouts,
  useLayoutAreas,
  useAreaPricingRows,
  useSaveAreas,
} from './hooks/useAreaPricing';
/** 어드민 콘솔의 공연 관리 목록 — /mine 을 그대로 쓰고 검색만 화면에서 거릅니다 */
export { useManagedConcerts } from './hooks/useManagedConcerts';
export { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard';

// View
export { ConcertForm } from './components/ConcertForm';
export { ScheduleEditor } from './components/ScheduleEditor';
export { AreaPricingEditor } from './components/AreaPricingEditor';
export { PhotocardDesignEditor } from './components/PhotocardDesignEditor';

// Model
export { organizerApi, organizerKeys } from './api/organizerApi';
export {
  buildAreaRows,
  validateAreaRows,
  toAreaSaveRequest,
  hasEnabledArea,
  capacityOf,
  canSellSeated,
  canSellStanding,
  sellableTypes,
  isUnsellable,
  pickSaleType,
  changeSaleType,

  exceedsVenueCapacity,
  type AreaPricingRow,
  type StadiumArea,
  type AreaSaveRequest,
} from './model/areaPricing';
export {
  EMPTY_CONCERT_CREATE,
  validateConcertCreate,
  isConcertCreateValid,
  concertToForm,
  isTicketingStarted,
  isConcertFormDirty,
  validateNewScheduleDate,
  arePhotocardDesignsValid,
  validatePhotocardDesign,
  filledPhotocardDesigns,
  EMPTY_PHOTOCARD_DESIGN,
  type ConcertCreateForm as ConcertCreateFormValues,
  type ConcertCreateErrors,
  type ConcertFormMode,
  type ConcertCreateResponse,
  type ConcertUpdateRequest,
  type ConcertVisibilityResponse,
  type StadiumSummary,
  type PhotocardDesignForm,
  type PhotocardDesignResponse,
} from './model/organizer.types';
