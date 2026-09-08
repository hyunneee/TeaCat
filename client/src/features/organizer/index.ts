/**
 * organizer feature 의 공개 API — 공연 관리(등록·수정·삭제).
 * 관리자 API(`/admin/**`)는 서버에서 ADMIN 역할만 허용합니다.
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
export { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard';

// View
export { ConcertForm } from './components/ConcertForm';
export { ScheduleEditor } from './components/ScheduleEditor';

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
  type ConcertCreateForm as ConcertCreateFormValues,
  type ConcertCreateErrors,
  type ConcertFormMode,
  type ConcertCreateResponse,
  type ConcertUpdateRequest,
  type ConcertVisibilityResponse,
  type StadiumSummary,
} from './model/organizer.types';
