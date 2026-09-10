/**
 * booking feature 의 공개 API.
 * 밖에서는 반드시 `@/features/booking` 으로만 가져다 씁니다.
 */

// Controller
export { useSections } from './hooks/useSections';
export { useSeatMap } from './hooks/useSeatMap';
export { useSectionSeats } from './hooks/useSectionSeats';
export { useBookingPolicy } from './hooks/useBookingPolicy';
export { useSeatSelection } from './hooks/useSeatSelection';
export { useSeatHold } from './hooks/useSeatHold';
export { useRecipients } from './hooks/useRecipients';

// View
export { VenueMap } from './components/VenueMap';
export { VenueMapLegend } from './components/VenueMapLegend';
export { SectionGrid } from './components/SectionGrid';
export { SeatMap } from './components/SeatMap';
export { SeatLegend } from './components/SeatLegend';
export { HoldTimer } from './components/HoldTimer';
export { HeldSeatNotice } from './components/HeldSeatNotice';
export { SelectedSeatBar } from './components/SelectedSeatBar';

// Model
export { useBookingStore, type HoldSession } from './store/bookingStore';
export { bookingApi, bookingKeys } from './api/bookingApi';
export {
  totalPrice,
  seatLabel,
  validateSelection,
  isSelectable,
  isSectionSoldOut,
  sectionAvailability,
  sectionBlockedReason,
  SECTION_AVAILABILITY_LABEL,
  isSectionBookable,
  priceLabel,
  sectionRemainRatio,
  type SectionAvailability,
} from './model/seat.model';
export type {
  Seat,
  SeatStatus,
  Section,
  SeatMapData,
  SeatHold,
  MyHold,
  BookingPolicy,
  Recipient,
} from './model/booking.types';
