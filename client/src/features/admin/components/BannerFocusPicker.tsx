import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Move, RotateCcw } from 'lucide-react';
import { clampFocus, DEFAULT_BANNER_FOCUS, objectPositionOf } from '@/features/banner';
import type { BannerImageFocus } from '@/features/banner';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/lib';

/**
 * 배너 그림에서 **보여줄 부분** 맞추기.
 *
 * 배너 틀은 폰 4:3, 데스크톱 2:1 입니다. 올린 그림이 그 비율이 아니면 반드시 잘리는데,
 * 기본값(가운데)이 늘 맞지는 않습니다 — 얼굴이 위에 있는 포스터는 가운데만 남기면
 * 목부터 보입니다. 그래서 등록하는 사람이 맞춥니다.
 *
 * 🔴 **그림을 직접 끌어서 맞춥니다.** 예전에는 그림 위 3×3 격자에서 한 칸을 눌렀는데,
 *    아홉 자리 중 가장 가까운 곳으로 튀어서 "누른 자리" 와 "남는 자리" 가 달랐습니다.
 *    끄는 방식은 손가락을 따라간 그대로가 결과라 미리보기가 곧 답입니다.
 *
 * 🔴 **미리보기는 실제 배너와 같은 방식으로 그립니다** — `object-cover` + `object-position`.
 *    끄는 동안 별도 계산으로 그리면 저장 뒤에 미세하게 어긋납니다. 여기서 끄는 거리는
 *    `object-position` 의 % 로만 환산합니다(아래 `focusAfterDrag`).
 *
 * 미리보기를 **둘** 두는 것도 이유가 있습니다. 값 하나가 두 틀에 함께 걸리므로
 * 한쪽만 보고 맞추면 다른 쪽에서 잘린 것을 등록 뒤에야 알게 됩니다.
 */
export interface BannerFocusPickerProps {
  /** 미리 볼 그림. 이미지 배너면 올린 그림, 공연 배너면 그 공연 포스터입니다 */
  imageUrl: string;
  value: BannerImageFocus;
  onChange: (focus: BannerImageFocus) => void;
}

/** 방향키 한 번에 움직이는 양(%). Shift 를 누르면 크게 움직입니다 */
const NUDGE = 2;
const NUDGE_FAST = 10;

/** 끄는 동안 붙잡고 있는 값. state 로 두면 한 번 움직일 때마다 다시 그려집니다 */
interface DragOrigin {
  pointerId: number;
  /** 누른 지점 (화면 좌표) */
  pointerX: number;
  pointerY: number;
  /** 누를 때의 값. 여기서부터의 차이로 계산합니다 — 더해 나가면 반올림 오차가 쌓입니다 */
  fromX: number;
  fromY: number;
  /**
   * 틀 밖으로 넘치는 양(px). `object-position` 의 0~100% 가 정확히 이 거리를 훑습니다.
   *
   * 🔴 0 이면 **그 방향으로는 잘리는 것이 없습니다** — 넘치는 게 없는데 움직이면
   *    값만 바뀌고 그림은 그대로라, 맞춰 놓고 저장했는데 아무 일도 없는 것이 됩니다.
   */
  overflowX: number;
  overflowY: number;
}

export function BannerFocusPicker({ imageUrl, value, onChange }: BannerFocusPickerProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragOrigin | null>(null);
  const [dragging, setDragging] = useState(false);

  const objectPosition = objectPositionOf(value.x, value.y);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    const image = imageRef.current;
    // 그림이 아직 안 왔으면 넘치는 양을 알 수 없습니다. 끌리는 척하면 안 됩니다
    if (!frame || !image?.naturalWidth || !image.naturalHeight) return;

    const rect = frame.getBoundingClientRect();
    /* `object-fit: cover` 가 쓰는 배율과 같은 식입니다. 이 배율로 커진 그림에서
       틀을 뺀 나머지가 0~100% 가 훑는 거리입니다 */
    const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);

    dragRef.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      fromX: value.x,
      fromY: value.y,
      overflowX: image.naturalWidth * scale - rect.width,
      overflowY: image.naturalHeight * scale - rect.height,
    };

    /* 틀 밖으로 손이 나가도 계속 따라옵니다. 안 잡아 두면 조금만 빨리 끌어도
       포인터가 틀을 벗어나면서 끌기가 끊깁니다 */
    frame.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const origin = dragRef.current;
    if (!origin || origin.pointerId !== event.pointerId) return;

    const next = focusAfterDrag(origin, event.clientX, event.clientY);
    if (next.x !== value.x || next.y !== value.y) onChange(next);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const origin = dragRef.current;
    if (!origin || origin.pointerId !== event.pointerId) return;

    frameRef.current?.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  };

  /**
   * 방향키로도 맞출 수 있어야 합니다. 끌기만 되면 마우스를 못 쓰는 사람은
   * 이 화면에서 할 수 있는 일이 없습니다.
   *
   * ⚠️ 끄는 것과 **방향이 반대**입니다. 그림을 왼쪽으로 끌면 오른쪽이 보이지만,
   * 방향키 ←는 "보는 자리를 왼쪽으로" 입니다 — 커서 이동과 같은 감각입니다.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? NUDGE_FAST : NUDGE;
    const moved: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };

    const delta = moved[event.key];
    if (!delta) return;

    event.preventDefault();
    onChange({ x: clampFocus(value.x + delta[0]), y: clampFocus(value.y + delta[1]) });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-ink text-sm font-medium">보여줄 부분</p>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RotateCcw size={14} />}
          onClick={() => onChange(DEFAULT_BANNER_FOCUS)}
        >
          가운데로
        </Button>
      </div>
      <p className="text-ink-muted text-xs">
        그림이 배너 비율과 다르면 나머지가 잘립니다. <b>그림을 끌어서</b> 남길 부분을 맞추세요
        (방향키로도 됩니다). 잘릴 것이 없는 방향으로는 움직이지 않습니다.
      </p>

      <div className="flex items-start gap-3">
        {/* 데스크톱(2:1) — 가장 많이 잘리는 틀이라 여기서 맞춥니다 */}
        <div className="min-w-0 flex-1 space-y-1">
          <div
            ref={frameRef}
            role="group"
            tabIndex={0}
            aria-label={`배너에서 보여줄 부분. 끌거나 방향키로 맞춥니다. 지금 가로 ${value.x}%, 세로 ${value.y}%`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onKeyDown={handleKeyDown}
            className={cn(
              'border-line relative aspect-[2/1] touch-none overflow-hidden rounded-xl border',
              /* 포커스 테두리는 공용 규칙(`focus-visible`)을 따릅니다 — 마우스로 눌렀을 때까지
                 테두리가 남으면 끌 때마다 화면이 번쩍입니다 */
              'focus-visible:ring-accent-600 outline-none focus-visible:ring-2',
              dragging ? 'cursor-grabbing' : 'cursor-grab',
            )}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="데스크톱 배너 미리보기"
              /* 브라우저 기본 이미지 끌기(고스트 이미지)가 뜨면 우리 끌기와 겹칩니다 */
              draggable={false}
              style={{ objectPosition }}
              className="size-full select-none object-cover"
            />

            {/* 끄는 동안에만 3등분 선. 늘 그려 두면 그림을 가려 무엇을 남길지 보기 어렵습니다 */}
            {dragging && (
              <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
              </div>
            )}

            {/* 끌 수 있다는 표시. 손잡이가 없으면 눌러보기 전에는 알 수 없습니다 */}
            {!dragging && (
              <span
                aria-hidden
                className="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[0.6875rem] text-white"
              >
                <Move size={12} />
                끌어서 맞추기
              </span>
            )}
          </div>
          <p className="text-ink-subtle text-center text-[0.6875rem] tabular-nums">
            데스크톱 (2:1) · 가로 {value.x}% · 세로 {value.y}%
          </p>
        </div>

        {/* 폰(4:3) — 같은 값이 여기에도 걸립니다. 끄는 곳은 아니라 읽기 전용입니다 */}
        <div className="w-24 shrink-0 space-y-1">
          <div className="border-line aspect-[4/3] overflow-hidden rounded-lg border">
            <img
              src={imageUrl}
              alt="폰 배너 미리보기"
              draggable={false}
              style={{ objectPosition }}
              className="size-full select-none object-cover"
            />
          </div>
          <p className="text-ink-subtle text-center text-[0.6875rem]">폰 (4:3)</p>
        </div>
      </div>
    </div>
  );
}

/**
 * 끈 거리(px) → 새 `object-position` 값(%).
 *
 * 🔴 **방향이 반대입니다.** 그림을 오른쪽으로 끌면 그림의 **왼쪽**이 드러나므로 x 는
 *    줄어듭니다. 부호를 뒤집으면 손과 그림이 서로 반대로 움직여 즉시 이상하게 느껴집니다.
 *
 * 넘치는 양이 0 인 방향은 건드리지 않습니다 — 그 방향은 잘리는 것이 없어서
 * 값을 바꿔도 그림이 그대로입니다 (0 으로 나누는 것도 막습니다).
 */
function focusAfterDrag(origin: DragOrigin, pointerX: number, pointerY: number): BannerImageFocus {
  const movedX = pointerX - origin.pointerX;
  const movedY = pointerY - origin.pointerY;

  return {
    x:
      origin.overflowX > 0
        ? clampFocus(origin.fromX - (movedX * 100) / origin.overflowX)
        : origin.fromX,
    y:
      origin.overflowY > 0
        ? clampFocus(origin.fromY - (movedY * 100) / origin.overflowY)
        : origin.fromY,
  };
}
