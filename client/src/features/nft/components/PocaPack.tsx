import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib';
import packUrl from '@/assets/poca/pack.webp';
import {
  PACK,
  canStartCut,
  cutPointAt,
  isCutThrough,
  shouldAddPoint,
  toClipPaths,
  toPackX,
  toSvgPath,
  type CutPoint,
} from '../model/pocaDraw.model';

interface Props {
  /** 이미 다 뜯었는가 — 두 조각이 갈라져 사라집니다 */
  opened: boolean;
  /** 첫 손이 닿았을 때. 여기서 뽑기 API 가 나갑니다 */
  onCutStart: () => void;
  /** 끝까지 잘렸을 때 */
  onCutThrough: () => void;
  className?: string;
}

/**
 * 포카 봉지 — 자르고, 두 조각으로 갈라집니다.
 *
 * ⭐ **같은 이미지를 두 번 겹쳐 놓고 서로 반대쪽만 `clip-path` 로 남깁니다.**
 * 조각난 이미지를 미리 만들 필요가 없고, 손가락이 지나간 경로 그대로 잘립니다.
 *
 * 서버를 모릅니다 — props 로 받은 것만 씁니다. (CLAUDE.md 4-3)
 */
export function PocaPack({ opened, onCutStart, onCutThrough, className }: Props) {
  const packRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<CutPoint[]>([]);
  const dragging = useRef(false);

  /* '한 번 더' 로 봉지가 새것이 되면 잘린 경로도 지웁니다.
     안 지우면 이전 경로가 남아 새 점을 받지 않고, **두 번째부터 안 뜯깁니다.** */
  useEffect(() => {
    if (!opened) setPoints([]);
  }, [opened]);

  const started = points.length > 0;
  const clip = opened ? toClipPaths(points) : null;
  const path = toSvgPath(points);

  /* 🔴 `setPoints` 업데이터 안에서 부모 콜백을 부르면 안 됩니다.
     업데이터는 **렌더 중에** 실행돼서 "다른 컴포넌트를 렌더하는 중에 상태를 바꿨다"는
     React 경고가 뜨고, StrictMode 에서는 두 번 불릴 수 있습니다.
     다 잘렸는지는 렌더가 끝난 뒤 effect 에서 판단합니다. */
  useEffect(() => {
    if (!opened && isCutThrough(points)) {
      dragging.current = false;
      onCutThrough();
    }
  }, [points, opened, onCutThrough]);

  const addPoint = (clientX: number) => {
    const box = packRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = toPackX(clientX, box.left, box.width);

    setPoints((prev) =>
      shouldAddPoint(prev, x) ? [...prev, cutPointAt(x, Math.random())] : prev,
    );
  };

  const handleDown = (e: React.PointerEvent) => {
    if (opened) return;
    const box = packRef.current?.getBoundingClientRect();
    if (!box) return;
    /* 절취선 근처에서 시작할 때만 — 봉지 아무 데나 눌러도 잘리면 안 됩니다 */
    const lineY = box.top + (PACK.cutY / PACK.height) * box.height;
    if (Math.abs(e.clientY - lineY) > 44) return;
    /* 왼쪽 끝에서만 시작합니다 — 오른쪽을 탭하는 것만으로 열리면 안 됩니다 */
    if (!canStartCut(toPackX(e.clientX, box.left, box.width))) return;

    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onCutStart();
    addPoint(e.clientX);
  };

  /**
   * 조각 하나 = 같은 이미지 + **그 조각에 속한 단면 선**.
   *
   * 🔴 단면 선을 조각 밖(봉지 루트)에 두면 조각이 날아간 뒤에도 **선만 허공에 남습니다.**
   * 조각 안에 넣어야 `clip-path` 로 같이 잘리고 애니메이션도 같이 따라갑니다.
   */
  const piece = (edgeStroke: string, edgeWidth: number, edgeShift: number) => (
    <>
      <img
        src={packUrl}
        alt=""
        draggable={false}
        className="pointer-events-none absolute max-w-none"
        style={{
          width: PACK.imageWidth,
          height: PACK.imageHeight,
          left: PACK.imageLeft,
          top: PACK.imageTop,
        }}
      />
      {started && (
        <svg
          viewBox={`0 0 ${PACK.width} ${PACK.height}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 overflow-visible"
        >
          <path
            d={path}
            fill="none"
            stroke={edgeStroke}
            strokeWidth={edgeWidth}
            transform={`translate(0 ${edgeShift})`}
          />
        </svg>
      )}
    </>
  );

  return (
    <div
      ref={packRef}
      onPointerDown={handleDown}
      onPointerMove={(e) => dragging.current && !opened && addPoint(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      className={cn(
        'relative z-[3] touch-none select-none',
        !opened && 'motion-safe:animate-poca-float',
        className,
      )}
      style={{ width: PACK.width, height: PACK.height }}
    >
      {/* 아랫조각 — 잘리기 전에는 봉지 전체. 단면은 밝은 선(종이 두께) */}
      <div
        className={cn(
          'absolute inset-0 overflow-hidden drop-shadow-[0_14px_28px_rgba(0,0,0,0.55)]',
          /* reduce 에서는 애니메이션이 안 돌아 봉지가 카드를 계속 가립니다 */
          opened && 'motion-safe:animate-poca-slide-down motion-reduce:opacity-0 overflow-visible',
        )}
        style={{ clipPath: clip?.bottom ?? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
      >
        {piece('rgba(255,255,255,.9)', 2, 0)}
      </div>

      {/* 윗조각 — 잘리기 전에는 아무것도 안 보입니다. 단면은 옅은 그늘 */}
      <div
        className={cn(
          'absolute inset-0 overflow-hidden drop-shadow-[0_14px_28px_rgba(0,0,0,0.55)]',
          opened && 'motion-safe:animate-poca-tear motion-reduce:opacity-0 overflow-visible',
        )}
        style={{ clipPath: clip?.top ?? 'polygon(0 0, 100% 0, 100% 0, 0 0)' }}
      >
        {piece('rgba(0,0,0,.4)', 1.2, -1.4)}
      </div>

      {/* 절취 안내 — 다 뜯으면 사라집니다 */}
      {!opened && (
        <>
          <div
            aria-hidden
            className="absolute right-2 left-2 h-0.5 mix-blend-difference"
            style={{
              top: PACK.cutY,
              backgroundImage:
                'repeating-linear-gradient(90deg, rgba(255,255,255,.95) 0 7px, transparent 7px 14px)',
            }}
          />
          <PocaScissors started={started} x={points[points.length - 1]?.x ?? 0} />
        </>
      )}
    </div>
  );
}

/**
 * 가위.
 *
 * 🔴 **팔이 꺾여 있어야 합니다.** 날끝과 손잡이가 축에서 일직선이면, 날이 맞물릴 때
 * 손잡이도 반드시 겹칩니다(손잡이가 축에 더 가까우므로 더 심하게). 실제 가위처럼
 * 손잡이 쪽을 넓게(±125°) 벌려 두면 30° 만 모아도 날은 만나고 손잡이는 떨어져 있습니다.
 */
function PocaScissors({ started, x }: { started: boolean; x: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]',
        /* 손대기 전에는 절취선을 따라 미끄러지며 어디를 자르는지 알려줍니다 */
        !started && 'motion-safe:animate-poca-sci-hint',
      )}
      style={
        {
          top: PACK.cutY,
          left: started ? `${(x / PACK.width) * 100}%` : 0,
          '--sci-travel': `${PACK.width}px`,
        } as React.CSSProperties
      }
    >
      <svg
        width={28}
        height={28}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g className="motion-safe:animate-poca-snip-a [transform-box:view-box] [transform-origin:12px_12px]">
          <path d="M21.4 5.4 10.36 13.15" />
          <path d="M10.36 13.15 8.26 16.93" />
          <circle cx="7" cy="19.2" r="2.6" />
        </g>
        <g className="motion-safe:animate-poca-snip-b [transform-box:view-box] [transform-origin:12px_12px]">
          <path d="M21.4 18.6 10.36 10.85" />
          <path d="M10.36 10.85 8.26 7.07" />
          <circle cx="7" cy="4.8" r="2.6" />
        </g>
        {/* 나사 — 회전축이 어디인지 보이게 */}
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
