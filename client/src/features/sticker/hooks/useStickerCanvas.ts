import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useDrawStore } from '../store/drawStore';
import { drawStroke, hasInk, renderDoodle, toNormalized } from '../model/sticker.model';
import { DOODLE_EXPORT_SIZE, eraserWidth, type Stroke } from '../model/sticker.types';

/** 레티나 배율 상한. 3 이상은 픽셀만 늘고 눈에 띄는 차이가 없습니다 */
const MAX_DPR = 3;

/**
 * 캔버스와 스토어를 잇는 훅. 페이지가 부르고, 결과를 `DrawCanvas` 에 props 로 내립니다.
 *
 * - 캔버스 크기는 CSS 가 정합니다(`.app-width` 안의 정사각형). 여기서는 그 크기를
 *   `ResizeObserver` 로 읽어 **실제 픽셀을 배율만큼 곱해** 잡습니다 (설계 5-3).
 * - 포인터 이벤트 하나로 마우스·터치·펜을 다 받습니다. `setPointerCapture` 로
 *   캔버스 밖으로 나가도 획이 끊기지 않게 합니다.
 * - 🔴 그리는 중인 획은 ref 에만 있고 캔버스에 **바로** 그립니다. 스토어에는 손을 뗄 때
 *   한 번 들어갑니다 — 움직일 때마다 상태를 바꾸면 리렌더로 선이 끊깁니다 (drawStore 주석).
 */
export function useStickerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentRef = useRef<Stroke | null>(null);
  /* 지우개 커서(원). 포인터를 따라다니는데, 위치를 상태로 두면 움직일 때마다 리렌더가 나서
     DOM 스타일을 직접 바꿉니다 — 그리는 중인 획을 ref 로 다루는 것과 같은 이유 */
  const cursorRef = useRef<HTMLDivElement>(null);
  const [cssSize, setCssSize] = useState(0);

  const strokes = useDrawStore((s) => s.strokes);
  const redo = useDrawStore((s) => s.redo);
  const tool = useDrawStore((s) => s.tool);
  const brush = useDrawStore((s) => s.brush);
  const newStroke = useDrawStore((s) => s.newStroke);
  const commitStroke = useDrawStore((s) => s.commitStroke);
  const setTool = useDrawStore((s) => s.setTool);
  const setBrush = useDrawStore((s) => s.setBrush);
  const color = useDrawStore((s) => s.color);
  const palette = useDrawStore((s) => s.palette);
  const setColor = useDrawStore((s) => s.setColor);
  const addColor = useDrawStore((s) => s.addColor);
  const undo = useDrawStore((s) => s.undo);
  const redoStroke = useDrawStore((s) => s.redoStroke);
  const clear = useDrawStore((s) => s.clear);
  const reset = useDrawStore((s) => s.reset);

  /* CSS 크기 추적 — 창 크기가 바뀌면 다시 그립니다 (좌표가 정규화돼 있어 그림은 그대로) */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setCssSize(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** 캔버스의 실제 픽셀 한 변. 0 이면 아직 크기를 모르는 상태 */
  const pixelSize = useCallback(() => {
    const el = canvasRef.current;
    if (!el || cssSize === 0) return 0;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const px = Math.round(cssSize * dpr);
    if (el.width !== px || el.height !== px) {
      el.width = px;
      el.height = px;
    }
    return px;
  }, [cssSize]);

  /* 확정된 획이 바뀔 때(되돌리기·지우기·새 획 커밋) 전체를 다시 그립니다 */
  useEffect(() => {
    const el = canvasRef.current;
    const px = pixelSize();
    const ctx = el?.getContext('2d');
    if (!ctx || px === 0) return;
    renderDoodle(ctx, strokes, px);
  }, [strokes, pixelSize]);

  const point = (e: PointerEvent<HTMLCanvasElement>) =>
    toNormalized(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());

  /** 커서 원을 포인터 자리로 옮깁니다 (지우개일 때만 보임 — 보이기/숨기기는 DrawCanvas 가 함) */
  const moveCursor = (e: PointerEvent<HTMLCanvasElement>) => {
    const el = cursorRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.style.transform = `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px) translate(-50%, -50%)`;
    el.style.opacity = '1';
  };
  const hideCursor = () => {
    if (cursorRef.current) cursorRef.current.style.opacity = '0';
  };

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return; // 오른쪽 버튼은 무시
      moveCursor(e);
      e.currentTarget.setPointerCapture(e.pointerId);
      const stroke = newStroke();
      stroke.points.push(point(e));
      currentRef.current = stroke;
      const ctx = e.currentTarget.getContext('2d');
      const px = pixelSize();
      if (ctx && px) drawStroke(ctx, stroke, px); // 점 하나라도 바로 보이게
    },
    [newStroke, pixelSize],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      moveCursor(e);
      const stroke = currentRef.current;
      if (!stroke) return;
      const p = point(e);
      const prev = stroke.points[stroke.points.length - 1]!;
      stroke.points.push(p);
      const ctx = e.currentTarget.getContext('2d');
      const px = pixelSize();
      /* 마지막 두 점만 이어 그립니다. 획 전체를 매번 다시 그리면 긴 획에서 느려집니다.
         끝이 둥근 선(round cap)이라 조각을 이어 붙여도 이음새가 보이지 않습니다. */
      if (ctx && px) drawStroke(ctx, { ...stroke, points: [prev, p] }, px);
    },
    [pixelSize],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      const stroke = currentRef.current;
      currentRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (stroke) commitStroke(stroke);
    },
    [commitStroke],
  );

  return {
    canvasRef,
    cursorRef,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onPointerLeave: hideCursor,
    },
    /** 캔버스의 화면상 한 변(px). 도구 줄이 "실제로 그려질 굵기" 를 보여줄 때 씁니다 */
    canvasSize: cssSize,
    /** 지금 지우개가 화면에서 차지하는 지름(px). 커서 원 크기 */
    eraserPx: Math.max(4, Math.round((eraserWidth(brush) * cssSize) / DOODLE_EXPORT_SIZE)),
    strokes,
    /** 그린 게 있나 — 만들기 버튼 활성 조건 */
    hasInk: hasInk(strokes),
    canUndo: strokes.length > 0,
    canRedo: redo.length > 0,
    tool,
    brush,
    color,
    palette,
    setTool,
    setBrush,
    setColor,
    addColor,
    undo,
    redo: redoStroke,
    clear,
    reset,
  };
}
