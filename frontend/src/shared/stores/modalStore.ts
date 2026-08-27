import { create } from 'zustand';

export interface ModalEntry {
  id: string;
  /** 어떤 모달인지 식별하는 키. 실제 컴포넌트 매핑은 app/providers/modals 에 있습니다. */
  type: string;
  props: Record<string, unknown>;
}

interface ModalState {
  /** 스택 구조 — 모달 위에 모달을 띄울 수 있습니다 (예: 좌석선택 → 결제확인) */
  stack: ModalEntry[];
  open: (type: string, props?: Record<string, unknown>) => string;
  close: (id?: string) => void;
  closeAll: () => void;
}

/**
 * 모달을 "컴포넌트 트리 안에서 조건부 렌더" 하지 않고 전역 스택으로 관리하는 이유:
 *  - 좌석맵 깊숙한 곳에서 결제 모달을 띄우려고 prop drilling 할 필요가 없음
 *  - 라우팅 이동 시 closeAll() 한 줄로 정리됨
 *  - 모달이 20개로 늘어나도 페이지 컴포넌트는 그대로임
 */
export const useModalStore = create<ModalState>((set) => ({
  stack: [],

  open: (type, props = {}) => {
    const id = crypto.randomUUID();
    set((s) => ({ stack: [...s.stack, { id, type, props }] }));
    return id;
  },

  close: (id) =>
    set((s) => ({
      stack: id ? s.stack.filter((m) => m.id !== id) : s.stack.slice(0, -1),
    })),

  closeAll: () => set({ stack: [] }),
}));
