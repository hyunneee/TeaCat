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
 * 동시에 띄울 수 있는 최대 개수.
 *
 * 탭이 백그라운드로 가면 브라우저가 setTimeout 을 throttling 해서
 * 자동 제거가 밀립니다. 사용자가 돌아왔을 때 토스트가 10개씩 쌓여 있으면
 * 화면을 다 가리므로, 오래된 것부터 밀어냅니다.
 */
const MAX_TOASTS = 3;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  show: (message, variant = 'info', durationMs = 3000) => {
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
