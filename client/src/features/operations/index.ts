/**
 * operations feature 의 공개 API — 운영 콘솔의 **좌석·예매자**.
 *
 * 담당 공연의 회차 하나를 놓고 좌석 현황·예매자 명단·입장 상태를 봅니다.
 * 검표(입장 처리)는 하지 않습니다 — 그건 `features/checkin` 의 일입니다.
 *
 * 🔴 서버는 ADMIN 과 **담당 공연** 기획자에게만 엽니다. 화면은 `can.viewSeatAttendees`
 *    (features/auth)로 먼저 막고, "그 공연이 내 공연인지" 는 서버가 매 요청 검사합니다.
 */

// Controller
export { useSeatOperations } from './hooks/useSeatOperations';

// View
export { OperationsSeatMap } from './components/OperationsSeatMap';
export { OperationsSeatLegend } from './components/OperationsSeatLegend';
export { OperationsSummaryBar } from './components/OperationsSummaryBar';
export { OperationsAttendeeTable } from './components/OperationsAttendeeTable';
export { OperationsAttendeeToolbar } from './components/OperationsAttendeeToolbar';
export { OperationsAttendeePanel } from './components/OperationsAttendeePanel';
export { OperationsStandingList } from './components/OperationsStandingList';

// Model
export { operationsApi, operationsKeys } from './api/operationsApi';
export {
  CHECK_IN_FILTER_LABEL,
  OPERATIONS_SEAT_FILL,
  OPERATIONS_SEAT_LABEL,
  OPERATIONS_SEAT_LEGEND,
  checkInRatio,
  hasTicket,
  isStanding,
  mappableAreas,
  seatLabel,
  seatText,
  standingAreas,
} from './model/operations.model';
export type {
  AttendeeQuery,
  OperationsArea,
  OperationsAttendee,
  OperationsAttendeeDetail,
  OperationsAttendeePage,
  OperationsCheckInFilter,
  OperationsSaleType,
  OperationsSeat,
  OperationsSeatMap as OperationsSeatMapData,
  OperationsSeatState,
  OperationsSummary,
  OperationsTicketStatus,
} from './model/operations.types';
