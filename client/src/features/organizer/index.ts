/**
 * organizer feature 의 공개 API — 공연 관리(등록·수정·삭제·회차·구역 가격).
 *
 * 서버의 `/admin/concerts/**` 는 **ADMIN 과 공연 주최자(PERFORMANCE)** 가 함께 씁니다.
 * 다루는 범위는 다릅니다 — PERFORMANCE 는 본인이 등록한 공연만, ADMIN 은 전체.
 *
 * 화면 입구가 둘입니다. 앱(`/concerts/...`)과 어드민 콘솔(`/admin/concerts/...`) 이
 * **같은 훅과 폼**을 씁니다 — 저장 뒤 갈 곳만 `ConcertRedirect` 로 달리 넘깁니다.
 */

// Controller
export {
  useCreateConcert,
  useUpdateConcert,
  useDeleteConcert,
  useStadiums,
} from './hooks/useCreateConcert';
export { useAddSchedule, useDeleteSchedule } from './hooks/useManageSchedules';
export { useMyConcerts, useMyConcert, useSetVisibility } from './hooks/useMyConcerts';
export {
  useManagedConcerts,
  useConcertAreas,
  useSaveConcertAreas,
} from './hooks/useManagedConcerts';
export { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard';

// View
export { ConcertForm } from './components/ConcertForm';
export { ScheduleEditor } from './components/ScheduleEditor';
export { AreaPricingEditor } from './components/AreaPricingEditor';
export { PhotocardDesignEditor } from './components/PhotocardDesignEditor';

// Model
export { organizerApi, organizerKeys } from './api/organizerApi';
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
  type ConcertArea,
  type ConcertAreaRow,
  type ConcertAreaSetting,
  type PhotocardDesignForm,
  type PhotocardDesignResponse,
} from './model/organizer.types';
