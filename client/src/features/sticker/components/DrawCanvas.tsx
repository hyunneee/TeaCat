import type { PointerEventHandler, ReactNode, RefObject } from 'react';
import { cn } from '@/shared/lib';

interface DrawCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** 지우개 커서(원). 훅이 포인터를 따라 위치를 직접 바꿉니다 */
  cursorRef: RefObject<HTMLDivElement | null>;
  handlers: {
    onPointerDown: PointerEventHandler<HTMLCanvasElement>;
    onPointerMove: PointerEventHandler<HTMLCanvasElement>;
    onPointerUp: PointerEventHandler<HTMLCanvasElement>;
    onPointerCancel: PointerEventHandler<HTMLCanvasElement>;
    onPointerLeave: PointerEventHandler<HTMLCanvasElement>;
  };
  /** 아직 아무것도 안 그렸으면 안내 문구를 가운데 띄웁니다 */
  empty: boolean;
  /** 지우개 모드면 기본 커서를 숨기고 지우개 크기의 원을 보여줍니다 */
  erasing: boolean;
  /** 지우개 원의 지름(px, 화면 기준) */
  eraserPx: number;
  /**
   * 캔버스 **위에** 띄울 도구들 (`BrushBar`). 그림판 가장자리에 붙어 있어야 손이 덜 움직입니다.
   * 빈 자리는 포인터를 통과시켜 그 아래 캔버스에 그려집니다 — 도구 칩만 이벤트를 받습니다.
   */
  children?: ReactNode;
  className?: string;
}

/**
 * 그림판. 그리기만 합니다 — 상태는 `useStickerCanvas` 가, 조립은 페이지가 합니다.
 *
 * - 폭은 부모(`.app-width` 안 `p-4`)를 따르고 `aspect-square` 로 정사각형을 만듭니다.
 *   실제 픽셀은 훅이 배율만큼 곱해 잡습니다.
 * - `touch-none`: 손가락으로 그릴 때 화면이 같이 스크롤되면 선이 끊깁니다.
 * - 테두리는 **굵고 진하게**(`border-2 border-line-strong`) — 흰 캔버스가 오프화이트 바탕 위에
 *   있어 가는 선으로는 "어디까지 그릴 수 있나" 가 안 보였습니다.
 * - 지우개일 때는 기본 커서 대신 **지우개 크기의 원**이 포인터를 따라다닙니다.
 *   어디가 얼마나 지워질지 보여야 지우개가 도구로 읽힙니다.
 */
export function DrawCanvas({
  canvasRef,
  cursorRef,
  handlers,
  empty,
  erasing,
  eraserPx,
  children,
  className,
}: DrawCanvasProps) {
  return (
    <div className={cn('relative aspect-square w-full', className)}>
      <canvas
        ref={canvasRef}
        {...handlers}
        aria-label="그림판"
        className={cn(
          'border-line-strong shadow-card block h-full w-full touch-none rounded-2xl border-2 bg-white',
          erasing ? 'cursor-none' : 'cursor-crosshair',
        )}
      />
      {/* 지우개 커서. 위치는 훅이 transform 으로 직접 옮기고, 여기서는 크기와 보임만 정합니다 */}
      <div
        ref={cursorRef}
        aria-hidden
        className={cn(
          'border-ink pointer-events-none absolute top-0 left-0 rounded-full border-2 bg-white/70 transition-opacity',
          !erasing && 'hidden',
        )}
        style={{ width: eraserPx, height: eraserPx, opacity: 0 }}
      />
      {empty && (
        <p
          aria-hidden
          className="text-muted pointer-events-none absolute inset-0 flex items-center justify-center text-sm"
        >
          여기에 그려 보세요
        </p>
      )}
      {children && (
        /* 겹침 층. 이 상자 자체는 포인터를 통과시키고(pointer-events-none),
           안의 칩들만 다시 받습니다(pointer-events-auto) — BrushBar 가 그렇게 그립니다 */
        <div className="pointer-events-none absolute inset-0 p-2">{children}</div>
      )}
    </div>
  );
}
