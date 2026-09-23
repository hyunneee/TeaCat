import { useRef, type PointerEvent } from 'react';
import { Move, X } from 'lucide-react';
import { cn } from '@/shared/lib';
import { clampPosition, clampScale } from '../model/decoration.model';
import type { Placed } from '../model/decoration.types';

interface Props {
  placed: Placed;
  selected: boolean;
  /** 카드 그림의 화면상 사각형. 비율 좌표 ↔ 화면 좌표를 오갈 때 쓰는 유일한 기준입니다 */
  getCardRect: () => DOMRect | null;
  onSelect: () => void;
  onChange: (patch: Partial<Placed>) => void;
  onRemove: () => void;
  /** 합성할 때 쓸 실제 `<img>` 를 페이지에 넘깁니다 (`composeDecorated` 주석) */
  registerImg: (el: HTMLImageElement | null) => void;
}

/**
 * 카드에 얹힌 스티커 한 장.
 *
 * ── 화면과 결과물이 어긋나지 않게 ──────────────────────────
 * 자리는 `left/top` 백분율 + `translate(-50%,-50%)`, 크기는 **폭 백분율**, 회전만 transform 입니다.
 * 🔴 `scale()` 로 키우지 않습니다 — transform 으로 키우면 손잡이와 테두리까지 같이 커져서
 *    작은 스티커에서는 손잡이가 점이 되고 큰 스티커에서는 화면을 덮습니다.
 *    합성 함수도 "폭 = 카드 폭 × scale" 로 그리므로 기준이 하나로 맞습니다.
 *
 * ── 손잡이는 둘뿐입니다 ────────────────────────────────────
 * 카드가 폭 300px 남짓이라 네 귀퉁이에 회전까지 달면 스티커보다 손잡이가 커집니다.
 *   ✕ 왼쪽 위 — 지우기
 *   ↘ 오른쪽 아래 — 크기 + 회전 **동시에**
 *
 * ── 🔴 잠긴 스티커 (2026-09-23) ────────────────────────────
 * `placed.locked` 가 켜진 것은 **이미 저장돼 카드에 붙은** 스티커입니다. 스티커는 한 번
 * 붙이면 뗄 수 없어서 끌기·손잡이·선택을 전부 막습니다 — 손잡이만 숨기면 끌어서 옮길 수
 * 있고, 그러면 저장할 때 서버가 `NFT_071` 로 거절합니다.
 */
export function DecorateSticker({
  placed,
  selected,
  getCardRect,
  onSelect,
  onChange,
  onRemove,
  registerImg,
}: Props) {
  /* 끌기: 손가락과 스티커 중심의 **차이**를 잡아 둡니다. 안 그러면 집는 순간
     스티커가 손가락 밑으로 순간이동합니다 */
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  /* 크기+회전: 집은 순간의 거리·각도·값을 기억해 **상대 변화**로 적용합니다.
     거리를 그대로 크기로 쓰면(절대값) 집는 순간 스티커가 튑니다 — 손잡이까지의 거리는
     스티커 비율에 따라 반폭보다 멀기 때문입니다. */
  const gestureRef = useRef<{ d0: number; a0: number; scale0: number; rotation0: number } | null>(
    null,
  );

  /** 카드 안에서의 중심 화면 좌표 */
  const centerOf = (rect: DOMRect) => ({
    cx: rect.left + placed.x * rect.width,
    cy: rect.top + placed.y * rect.height,
  });

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation(); // 빈 곳 탭(선택 해제)으로 새어 나가지 않게
    onSelect();
    const rect = getCardRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      dx: placed.x - (e.clientX - rect.left) / rect.width,
      dy: placed.y - (e.clientY - rect.top) / rect.height,
    };
  };

  const moveDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const rect = getCardRect();
    if (!d || !rect) return;
    onChange({
      x: clampPosition((e.clientX - rect.left) / rect.width + d.dx),
      y: clampPosition((e.clientY - rect.top) / rect.height + d.dy),
    });
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const startGesture = (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onSelect();
    const rect = getCardRect();
    if (!rect) return;
    const { cx, cy } = centerOf(rect);
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    e.currentTarget.setPointerCapture(e.pointerId);
    gestureRef.current = {
      d0: Math.max(1, Math.hypot(dx, dy)),
      a0: Math.atan2(dy, dx),
      scale0: placed.scale,
      rotation0: placed.rotation,
    };
  };

  const moveGesture = (e: PointerEvent<HTMLButtonElement>) => {
    const g = gestureRef.current;
    const rect = getCardRect();
    if (!g || !rect) return;
    const { cx, cy } = centerOf(rect);
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    onChange({
      scale: clampScale(g.scale0 * (Math.hypot(dx, dy) / g.d0)),
      rotation: g.rotation0 + ((Math.atan2(dy, dx) - g.a0) * 180) / Math.PI,
    });
  };

  const endGesture = (e: PointerEvent<HTMLButtonElement>) => {
    gestureRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      /* touch-none: 끌 때 화면이 같이 스크롤되지 않게. 이게 없으면 폰에서 스티커가
         안 따라오고 페이지만 움직입니다 */
      className="absolute touch-none select-none"
      style={{
        left: `${placed.x * 100}%`,
        top: `${placed.y * 100}%`,
        width: `${placed.scale * 100}%`,
        transform: `translate(-50%, -50%) rotate(${placed.rotation}deg)`,
      }}
      /* 🔴 잠긴 것은 집히지도 않습니다. 핸들러를 안 달아 이벤트가 카드로 넘어가고,
         빈 곳을 누른 것처럼 선택이 풀립니다 */
      onPointerDown={placed.locked ? undefined : startDrag}
      onPointerMove={placed.locked ? undefined : moveDrag}
      onPointerUp={placed.locked ? undefined : endDrag}
      onPointerCancel={placed.locked ? undefined : endDrag}
    >
      <img
        ref={registerImg}
        src={placed.url}
        alt=""
        /* 🔴 이게 없으면 합성 때 캔버스가 잠깁니다 (`composeDecorated` 주석) */
        crossOrigin="anonymous"
        draggable={false}
        className={cn(
          'pointer-events-none block w-full',
          selected && 'outline-accent-600 outline-2 outline-dashed',
        )}
      />

      {selected && !placed.locked && (
        <>
          <button
            type="button"
            aria-label="스티커 지우기"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="bg-danger absolute -top-3 -left-3 flex size-7 items-center justify-center rounded-full text-white shadow-md"
          >
            <X size={15} strokeWidth={2.5} />
          </button>

          <button
            type="button"
            aria-label="크기와 각도 바꾸기"
            onPointerDown={startGesture}
            onPointerMove={moveGesture}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            className="bg-accent-700 absolute -right-3 -bottom-3 flex size-7 touch-none items-center justify-center rounded-full text-white shadow-md"
          >
            <Move size={14} strokeWidth={2.5} />
          </button>
        </>
      )}
    </div>
  );
}
