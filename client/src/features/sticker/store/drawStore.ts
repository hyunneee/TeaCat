import { create } from 'zustand';
import {
  BRUSH_DEFAULT,
  BRUSH_MAX,
  BRUSH_MIN,
  INK_DEFAULT,
  INK_PALETTE,
  INK_PALETTE_MAX,
  MAX_UNDO,
  eraserWidth,
  type DrawTool,
  type Stroke,
} from '../model/sticker.types';

/**
 * 그리는 중인 화면 상태 (CLAUDE.md 3-4: 화면 상태는 Zustand).
 *
 * 서버 데이터는 하나도 없습니다 — 획, 도구, 굵기, 되돌리기만. 만들기 요청과 결과는
 * TanStack Query 가 들고, 이 스토어는 요청을 보낸 뒤에도 그림을 그대로 갖고 있어
 * "다시 만들기" 가 같은 낙서로 다시 요청할 수 있습니다.
 *
 * 🔴 **그리는 중인 획은 여기 없습니다.** 포인터가 움직일 때마다 스토어를 갱신하면
 * 한 획에 수백 번 리렌더가 나서 선이 끊깁니다. 진행 중인 획은 훅의 ref 에 두고
 * 캔버스에 바로 그리며, **손을 떼는 순간** `commitStroke` 로 한 번만 들어옵니다.
 */
interface DrawState {
  strokes: Stroke[];
  /** 되돌리기로 뺀 획. 새 획을 그리면 버립니다 (일반적인 undo/redo 규칙) */
  redo: Stroke[];
  tool: DrawTool;
  /** 붓 굵기 (1024px 기준). 슬라이더 값 그대로. 지우개 굵기는 여기서 비율로 계산 */
  brush: number;
  /** 지금 잉크 색 (hex) */
  color: string;
  /** 기본 4색 + 사용자가 더한 색. 화면을 벗어나면 초기화됩니다(저장 안 함) */
  palette: string[];

  setTool: (tool: DrawTool) => void;
  setBrush: (brush: number) => void;
  /** 색을 고르면 도구도 펜으로 바뀝니다 — 지우개 상태에서 색을 골라 놓고 왜 안 칠해지나 하는 일을 막음 */
  setColor: (color: string) => void;
  /** `+` 로 색 추가. 이미 있으면 그 색을 고르기만, 상한을 넘으면 가장 오래된 추가색을 뺍니다 */
  addColor: (color: string) => void;
  /** 지금 도구·굵기로 새 획의 뼈대를 만듭니다 (점은 훅이 채움) */
  newStroke: () => Stroke;
  commitStroke: (stroke: Stroke) => void;
  undo: () => void;
  redoStroke: () => void;
  clear: () => void;
  reset: () => void;
}

const initial = {
  strokes: [] as Stroke[],
  redo: [] as Stroke[],
  tool: 'pen' as DrawTool,
  brush: BRUSH_DEFAULT,
  color: INK_DEFAULT,
  palette: [...INK_PALETTE] as string[],
};

const normalizeHex = (c: string) => c.trim().toLowerCase();

export const useDrawStore = create<DrawState>((set, get) => ({
  ...initial,

  setTool: (tool) => set({ tool }),
  setBrush: (brush) => set({ brush: Math.min(BRUSH_MAX, Math.max(BRUSH_MIN, Math.round(brush))) }),
  setColor: (color) => set({ color: normalizeHex(color), tool: 'pen' }),

  addColor: (raw) =>
    set((s) => {
      const color = normalizeHex(raw);
      if (s.palette.includes(color)) return { color, tool: 'pen' };
      /* 4칸 고정: 첫 칸(검정)은 지키고, 둘째 칸(가장 오래된 색)을 빼고 새 색을 끝에 넣습니다 */
      const palette =
        s.palette.length >= INK_PALETTE_MAX
          ? [s.palette[0]!, ...s.palette.slice(2), color]
          : [...s.palette, color];
      return { palette, color, tool: 'pen' };
    }),

  newStroke: () => {
    const { tool, brush, color } = get();
    return { tool, width: tool === 'eraser' ? eraserWidth(brush) : brush, color, points: [] };
  },

  commitStroke: (stroke) => {
    if (stroke.points.length === 0) return;
    set((s) => ({
      // 상한을 넘으면 가장 오래된 획이 되돌리기 범위에서 빠집니다 (그림에서는 안 사라짐)
      strokes: [...s.strokes, stroke].slice(-MAX_UNDO * 4),
      redo: [],
    }));
  },

  undo: () =>
    set((s) => {
      if (s.strokes.length === 0) return s;
      const last = s.strokes[s.strokes.length - 1]!;
      return { strokes: s.strokes.slice(0, -1), redo: [...s.redo, last].slice(-MAX_UNDO) };
    }),

  redoStroke: () =>
    set((s) => {
      if (s.redo.length === 0) return s;
      const next = s.redo[s.redo.length - 1]!;
      return { strokes: [...s.strokes, next], redo: s.redo.slice(0, -1) };
    }),

  /* 전부 지우기 — 되돌릴 수 없습니다(획 단위 스택에 한 덩어리를 넣을 수 없음).
     그래서 화면이 확인 모달을 먼저 띄웁니다 (CLAUDE.md 4-7). */
  clear: () => set({ strokes: [], redo: [] }),
  reset: () => set(initial),
}));
