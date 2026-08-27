/**
 * booking feature 의 공개 API.
 * 밖에서는 반드시 `@/features/booking` 으로만 가져다 씁니다.
 */

// Controller
export { useSections } from './hooks/useSections';
export { useSeatMap } from './hooks/useSeatMap';
export { useSeatSelection } from './hooks/useSeatSelection';
export { useSeatHold } from './hooks/useSeatHold';
export { useRecipients } from './hooks/useRecipients';

// View
export { SectionGrid } from './components/SectionGrid';
export { SeatMap } from './components/SeatMap';
export { SeatLegend } from './components/SeatLegend';
export { HoldTimer } from './components/HoldTimer';
export { SelectedSeatBar } from './components/SelectedSeatBar';

// Model
export { useBookingStore } from './store/bookingStore';
export { bookingApi, bookingKeys } from './api/bookingApi';
export {
  totalPrice,
  seatLabel,
  validateSelection,
  isSectionSoldOut,
  sectionRemainRatio,
} from './model/seat.model';
export type {
  Seat,
  SeatStatus,
  Section,
  SeatMapData,
  SeatHold,
  HoldDetail,
  Recipient,
  Order,
  CreateOrderRequest,
} from './model/booking.types';
