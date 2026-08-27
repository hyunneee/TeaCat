import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Recipient, SeatHold } from '../model/booking.types';

interface BookingState {
  scheduleId: string | null;
  /** 구역 선택 단계에서 고른 구역 */
  sectionId: string | null;
  /** 아직 서버에 락을 걸지 않은, 화면에서만 고른 좌석 */
  selectedSeatIds: string[];
  /** 서버가 잡아준 락 정보 */
  hold: SeatHold | null;
  /** 좌석별 티켓 수령인 (단순 양도 방지 — 결제 시점에 확정) */
  recipients: Recipient[];
  /** 결제 요청에 쓸 멱등키. 플로우 시작 시 1회 생성해 재시도해도 유지합니다. */
  idempotencyKey: string | null;

  startSession: (scheduleId: string) => void;
  selectSection: (sectionId: string) => void;
  toggleSeat: (seatId: string) => void;
  clearSelection: () => void;
  setHold: (hold: SeatHold | null) => void;
  setRecipient: (seatId: string, loginId: string) => void;
  ensureIdempotencyKey: () => string;
  reset: () => void;
}

const initial = {
  scheduleId: null,
  sectionId: null,
  selectedSeatIds: [],
  hold: null,
  recipients: [],
  idempotencyKey: null,
} satisfies Omit<
  BookingState,
  | 'startSession'
  | 'selectSection'
  | 'toggleSeat'
  | 'clearSelection'
  | 'setHold'
  | 'setRecipient'
  | 'ensureIdempotencyKey'
  | 'reset'
>;

/**
 * 예매 플로우 한 판의 상태.
 *
 * OTP → 구역 → 좌석 → 확인 → 결제, 다섯 페이지가 이 스토어를 공유합니다.
 * (좌석 목록이나 수령인을 URL 파라미터로 넘기면 주소창 조작이 가능해 위험합니다)
 *
 * ⚠️ sessionStorage 에 유지하는 이유
 * 모바일 결제창은 **페이지를 이동**해서 뜹니다. PG 에서 돌아올 때는 전체
 * 재로딩이라 메모리에만 있던 hold·멱등키가 사라지고, 결제 결과를 처리하기 전에
 * "선점 없음" 가드가 발동해 구역 선택으로 튕깁니다.
 * sessionStorage 면 리디렉션·새로고침을 견디고, 탭을 닫으면 정리됩니다.
 * (localStorage 를 쓰면 며칠 전 예매 흔적이 남아 더 헷갈립니다)
 */
export const useBookingStore = create<BookingState>()(persist((set, get) => ({
  ...initial,

  startSession: (scheduleId) => {
    // 다른 회차로 넘어오면 이전 선택은 전부 버립니다.
    if (get().scheduleId !== scheduleId) set({ ...initial, scheduleId });
  },

  selectSection: (sectionId) => {
    // 구역을 바꾸면 그 전 구역에서 고른 좌석은 의미가 없습니다.
    if (get().sectionId !== sectionId) set({ sectionId, selectedSeatIds: [] });
  },

  toggleSeat: (seatId) =>
    set((s) => ({
      selectedSeatIds: s.selectedSeatIds.includes(seatId)
        ? s.selectedSeatIds.filter((id) => id !== seatId)
        : [...s.selectedSeatIds, seatId],
    })),

  clearSelection: () => set({ selectedSeatIds: [] }),

  setHold: (hold) => set({ hold }),

  setRecipient: (seatId, loginId) =>
    set((s) => {
      const rest = s.recipients.filter((r) => r.seatId !== seatId);
      return { recipients: [...rest, { seatId, loginId }] };
    }),

  ensureIdempotencyKey: () => {
    const existing = get().idempotencyKey;
    if (existing) return existing;
    const key = crypto.randomUUID();
    set({ idempotencyKey: key });
    return key;
  },

  reset: () => set(initial),
}), {
  name: 'tikat.booking',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (s) => ({
    scheduleId: s.scheduleId,
    sectionId: s.sectionId,
    selectedSeatIds: s.selectedSeatIds,
    hold: s.hold,
    recipients: s.recipients,
    idempotencyKey: s.idempotencyKey,
  }),
}));
