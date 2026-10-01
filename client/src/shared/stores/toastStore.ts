import { create } from 'zustand';

export type ToastVariant = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, variant?: ToastVariant, durationMs?: number) => void;
  dismiss: (id: string) => void;
}

/**
 * 동시에 띄울 수 있는 최대 개수 — 한 번에 하나만, 새 것이 이전 것을 밀어냅니다.
 *
 * 탭이 백그라운드로 가면 브라우저가 setTimeout 을 throttling 해서
 * 자동 제거가 밀립니다. 사용자가 돌아왔을 때 토스트가 여러 개 쌓여 있으면
 * 화면을 가리므로, 오래된 것부터 밀어냅니다.
 */
const MAX_TOASTS = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: (message, variant = 'info', durationMs = 3000) => {
    /* 같은 문구가 이미 떠 있으면 하나 더 띄우지 않습니다. 게이트 QR 스캔처럼 같은 실패가
       초당 몇 번씩 반복되면 "이미 입장한 티켓입니다" 가 줄줄이 쌓입니다 */
    if (get().toasts.some((t) => t.message === message && t.variant === variant)) return;

    const id = crypto.randomUUID();

    set((s) => ({ toasts: [...s.toasts, { id, message, variant }].slice(-MAX_TOASTS) }));

    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, durationMs);
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** 컴포넌트 밖(인터셉터, 이벤트 핸들러)에서도 호출 가능 */
export const toast = {
  info: (m: string) => useToastStore.getState().show(m, 'info'),
  success: (m: string) => useToastStore.getState().show(m, 'success'),
  error: (m: string) => useToastStore.getState().show(m, 'error'),
};
