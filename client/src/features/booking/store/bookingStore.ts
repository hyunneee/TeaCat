import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Recipient, SeatHold } from '../model/booking.types';

/**
 * 스토어에 담는 선점 정보.
 *
 * 서버 응답(`SeatHold`)에 두 가지를 더 붙입니다.
 *
 * `receivedAt` — 응답을 받은 **클라이언트 시각**.
 *   서버는 남은 시간을 초(`remainingSeconds`)로 주므로, 그것만으로는
 *   "지금 몇 초 남았는지" 를 다시 계산할 수 없습니다. 받은 순간을 함께
 *   적어두면 `receivedAt + remainingSeconds * 1000` 이 클라이언트 시계 기준
 *   만료 시각이 되고, 새로고침·결제창 복귀 후에도 그대로 유효합니다.
 *   (서버 시각을 클라이언트 시계와 직접 비교하면 기기 시각이 틀어진 사용자에게
 *    엉뚱한 타이머가 보입니다)
 *
 * `holdId` / `seatIds` — 🔴 **임시 호환 필드입니다. 서버에 없습니다.**
 *   서버 선점은 (회차, 좌석, 사용자) 로 식별되고 holdId 라는 개념이 없습니다.
 *   그런데 결제가 아직 목업이고 그 목업이 holdId + seatIds 를 요구합니다.
 *   결제 화면을 이번 작업 범위에서 제외했으므로, 그쪽 코드를 건드리지 않기 위해
 *   여기서 합성해 둡니다.
 *   TODO(backend): 실제 결제 API 가 나오면 이 두 필드와 `features/payment` 의
 *   holdId 사용처를 함께 지우고 (회차, 좌석) 기준으로 바꾸세요.
 */
export type HoldSession = SeatHold & {
  receivedAt: number;
  /** @deprecated 서버에 없는 합성값 — 결제 목업 호환용 */
  holdId: string;
  /** @deprecated 1인 1좌석이라 항상 길이 1 — 결제 목업 호환용 */
  seatIds: string[];
};

interface BookingState {
  scheduleId: string | null;
  /** 구역 선택 단계에서 고른 구역 */
  sectionId: string | null;
  /**
   * 아직 서버에 락을 걸지 않은, 화면에서만 고른 좌석.
   * 1인 1매 정책이라 실제로는 0개 또는 1개입니다 (배열은 정책이 늘어날 때를 위해 유지).
   */
  selectedSeatIds: string[];
  /** 서버가 잡아준 락 정보 */
  hold: HoldSession | null;
  /** 좌석별 티켓 수령인 (단순 양도 방지 — 결제 시점에 확정) */
  recipients: Recipient[];
  /** 결제 요청에 쓸 멱등키. 플로우 시작 시 1회 생성해 재시도해도 유지합니다. */
  idempotencyKey: string | null;

  /** 플로우를 처음부터 시작합니다 (봇 확인 통과 시점). 이전 판은 버립니다. */
  beginFlow: (scheduleId: string) => void;
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
  | 'beginFlow'
  | 'startSession'
  | 'selectSection'
  | 'toggleSeat'
  | 'clearSelection'
  | 'setHold'
  | 'setRecipient'
  | 'ensureIdempotencyKey'
  | 'reset'
>;

/** 서버 응답을 스토어에 담을 형태로. 만료 계산의 기준점을 여기서 한 번만 찍습니다 */
function toSession(hold: SeatHold): HoldSession {
  return {
    ...hold,
    receivedAt: Date.now(),
    holdId: `${hold.scheduleId}:${hold.seatId}`,
    seatIds: [hold.seatId],
  };
}

/** 스토어에 남아 있는 선점이 이미 만료됐는지 */
const isExpired = (hold: HoldSession) =>
  hold.receivedAt + hold.remainingSeconds * 1000 <= Date.now();

/**
 * 예매 플로우 한 판의 상태.
 *
 * 봇 확인 → 구역 → 좌석 → 확인 → 결제, 다섯 페이지가 이 스토어를 공유합니다.
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

  /**
   * 예매 플로우의 진짜 시작점 — 봇 확인을 통과한 순간.
   *
   * 같은 회차를 다시 예매하는 경우에도 이전 판(선점·수령인·멱등키)을 버려야 합니다.
   * 남겨두면 이전 선점이 만료되는 순간 만료 처리가 발동해서
   * **방금 고른 좌석이 풀립니다.** (서버의 이전 선점은 TTL 로 알아서 해제됩니다)
   */
  beginFlow: (scheduleId) => set({ ...initial, scheduleId }),

  startSession: (scheduleId) => {
    const current = get();

    // sessionStorage 에 유지되므로, 결제를 끝내지 않고 나갔던 판이 남아 있을 수 있습니다.
    // 만료된 선점을 그대로 두면 새 예매를 시작한 직후 만료 처리가 발동해
    // 방금 고른 좌석이 풀려버립니다.
    const expired = current.hold ? isExpired(current.hold) : false;

    // 다른 회차로 넘어왔거나, 남아있던 선점이 이미 만료됐으면 새 판으로 시작합니다.
    if (current.scheduleId !== scheduleId || expired) set({ ...initial, scheduleId });
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

  setHold: (hold) => set({ hold: hold === null ? null : toSession(hold) }),

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
