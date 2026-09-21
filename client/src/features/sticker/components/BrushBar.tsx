import { useRef, useState } from 'react';
import { Eraser, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import {
  BRUSH_MAX,
  BRUSH_MIN,
  DOODLE_EXPORT_SIZE,
  eraserWidth,
  type DrawTool,
} from '../model/sticker.types';

interface BrushBarProps {
  tool: DrawTool;
  /** 붓 굵기 (1024px 기준, BRUSH_MIN~BRUSH_MAX) */
  brush: number;
  /** 캔버스의 화면상 한 변(px). 굵기 미리보기를 **실제 그려질 크기**로 보여주기 위해 받습니다 */
  canvasSize: number;
  /** 지금 잉크 색 (hex) */
  color: string;
  /** 팔레트 4칸 */
  palette: string[];
  canUndo: boolean;
  onTool: (tool: DrawTool) => void;
  onBrush: (brush: number) => void;
  onColor: (color: string) => void;
  onAddColor: (color: string) => void;
  onUndo: () => void;
  onClear: () => void;
}

/** 캔버스 위에 뜨는 칩. 불투명한 면 + 그림자로 층을 만듭니다 (DESIGN.md: 글래스 금지, 발광 금지) */
const CHIP = 'pointer-events-auto surface shadow-card flex items-center gap-0.5 rounded-xl p-1';

/**
 * 도구 — **캔버스 안에** 한 줄로 떠 있습니다 (`DrawCanvas` 의 children).
 *
 *   ┌────────────────────────────────────────────┐
 *   │ [펜] (●●●● +) │ [지우개]        [↶] [🗑]   │  ← 한 줄. 팔레트는 캡슐, 지우개 앞에 구분선
 *   │                                            │
 *   │                 (그리는 곳)                 │
 *   │ [굵기 ● ────────○──────────]               │  ← 잡으면 실제 굵기 원이 뜸
 *   └────────────────────────────────────────────┘
 *
 * ⚠️ 버튼이 **36px** 입니다 (CLAUDE.md 4-4 의 44px 보다 작음). 폰 폭 343px 캔버스에 펜·색 4·`+`·
 *    지우개·되돌리기·휴지통을 **한 줄**에 넣으려면 44px 로는 안 들어갑니다(약 400px 필요). 같은 이유로
 *    "다시 실행" 은 뺐습니다 — 되돌리기 하나로 충분하고, 한 줄 배치가 더 중요하다는 판단.
 *    캔버스 안 도구 줄은 일반 버튼이 아니라 팔레트 성격이라 예외로 두되, 그 밖의 버튼은 44px 그대로입니다.
 *
 * 팔레트는 펜일 때만 보입니다 — 지우개에 색은 뜻이 없습니다. 색을 고르면 도구가 펜으로 바뀝니다.
 * `+` 는 브라우저 기본 색 고르기(`<input type="color">`)를 엽니다. 더하면 한 칸이 빠집니다(4칸 고정).
 *
 * 🔴 색값은 `INK_PALETTE`(model) 한 곳에서만 옵니다. 여기서는 받은 hex 를 그대로 칩 배경에
 *    씁니다 — 화면 UI 색이 아니라 **사용자의 잉크 색**이라 `CLAUDE.md` 4-6 예외로 등록돼 있습니다.
 */
export function BrushBar({
  tool,
  brush,
  canvasSize,
  color,
  palette,
  canUndo,
  onTool,
  onBrush,
  onColor,
  onAddColor,
  onUndo,
  onClear,
}: BrushBarProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  /* 실제로 그려질 굵기(px): 1024 기준 값을 캔버스 화면 크기에 비례해 줄인 것.
     `drawStroke` 의 lineWidth 계산과 같은 식이라 미리보기와 선이 정확히 같은 굵기입니다. */
  const width1024 = tool === 'eraser' ? eraserWidth(brush) : brush;
  const realPx = Math.max(2, Math.round((width1024 * (canvasSize || 340)) / DOODLE_EXPORT_SIZE));
  /* 슬라이더 옆 작은 점은 자리가 좁아 22px 까지만 */
  const previewPx = Math.min(22, Math.max(4, realPx));

  /* 잡고 움직이는 동안 손잡이 위에 지금 값을 띄웁니다.
     🔴 누름과 포커스를 **따로** 셉니다 — 클릭은 누름 → 포커스 → 뗌 순서라 한 플래그로 하면
     뗄 때 꺼져서 마우스 클릭 조정에서는 값이 한 번도 안 보입니다. */
  const [pressing, setPressing] = useState(false);
  const [focused, setFocused] = useState(false);
  const adjusting = pressing || focused;
  const pct = ((brush - BRUSH_MIN) / (BRUSH_MAX - BRUSH_MIN)) * 100;
  /* 손잡이(약 16px)는 트랙 양끝에서 안쪽으로 붙으므로 % 위치를 그만큼 보정합니다 */
  const badgeLeft = `calc(${pct}% + ${(0.5 - pct / 100) * 16}px)`;

  const inkStyle = tool === 'eraser' ? undefined : { backgroundColor: color };
  const iconBtn = 'size-9 px-0'; // 36px

  return (
    <div className="flex h-full flex-col justify-between">
      {/* 한 줄: 펜 · (펜일 때) 팔레트 캡슐 · 구분선 · 지우개 ────── 되돌리기 · 휴지통 */}
      <div className="flex items-start justify-between gap-1">
        <div className={CHIP} role="group" aria-label="도구">
          <Button
            variant={tool === 'pen' ? 'dark' : 'ghost'}
            size="sm"
            aria-label="펜"
            aria-pressed={tool === 'pen'}
            className={iconBtn}
            onClick={() => onTool('pen')}
          >
            <Pencil size={17} />
          </Button>

          {tool === 'pen' && (
            /* 팔레트 캡슐 — 색 4칸과 + 를 한 덩어리로 묶습니다 */
            <div
              className="bg-surface-2 flex items-center gap-0.5 rounded-full px-1 py-0.5"
              role="radiogroup"
              aria-label="잉크 색"
            >
              {palette.map((c) => {
                const selected = c === color;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`색 ${c}`}
                    onClick={() => onColor(c)}
                    className="flex size-6 items-center justify-center rounded-full"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'block rounded-full border-2 transition-transform',
                        selected ? 'border-ink size-[22px]' : 'border-line size-[18px]',
                      )}
                      style={{ backgroundColor: c }}
                    />
                  </button>
                );
              })}
              <button
                type="button"
                aria-label="색 추가"
                onClick={() => colorInputRef.current?.click()}
                className="text-muted hover:text-ink flex size-6 items-center justify-center rounded-full"
              >
                <Plus size={16} />
              </button>
              {/* 보이지 않는 네이티브 색 입력. 버튼이 대신 열어 줍니다 */}
              <input
                ref={colorInputRef}
                type="color"
                defaultValue={color}
                tabIndex={-1}
                aria-hidden
                className="sr-only"
                onChange={(e) => onAddColor(e.target.value)}
              />
            </div>
          )}

          {/* 팔레트와 지우개 사이 구분선 — 지우개가 색 중 하나로 읽히지 않게 */}
          <span aria-hidden className="bg-line-strong mx-1 h-6 w-px" />

          <Button
            variant={tool === 'eraser' ? 'dark' : 'ghost'}
            size="sm"
            aria-label="지우개"
            aria-pressed={tool === 'eraser'}
            className={iconBtn}
            onClick={() => onTool('eraser')}
          >
            <Eraser size={17} />
          </Button>
        </div>

        <div className={CHIP} role="group" aria-label="되돌리기">
          <Button
            variant="ghost"
            size="sm"
            aria-label="되돌리기"
            className={iconBtn}
            disabled={!canUndo}
            onClick={onUndo}
          >
            <Undo2 size={17} />
          </Button>
          {/* 전부 지우기는 되돌릴 수 없는 동작 → danger-ghost + 확인 모달(페이지) (CLAUDE.md 4-7) */}
          <Button
            variant="danger-ghost"
            size="sm"
            aria-label="전부 지우기"
            className={iconBtn}
            disabled={!canUndo}
            onClick={onClear}
          >
            <Trash2 size={17} />
          </Button>
        </div>
      </div>

      {/* 굵기 슬라이더. 네이티브 range — 키보드·터치·스크린리더가 다 됩니다 */}
      <label className={cn(CHIP, 'h-11 gap-3 rounded-2xl px-3')}>
        <span className="text-muted shrink-0 text-xs">굵기</span>
        <span className="flex w-6 shrink-0 items-center justify-center" aria-hidden>
          <span
            className={cn('block rounded-full', tool === 'eraser' && 'border-ink border-2 bg-white')}
            style={{ width: previewPx, height: previewPx, ...inkStyle }}
          />
        </span>
        <span className="relative flex w-full items-center">
          {adjusting && (
            /* 손잡이 위에 **실제 굵기의 원**을 지금 잉크 색으로 띄웁니다 (숫자는 단위가 없어 감이 안 옴).
               지우개는 흰 원에 테두리 — 캔버스에 그려질 모양 그대로 */
            <span
              aria-hidden
              className="surface shadow-card pointer-events-none absolute flex -translate-x-1/2 items-center justify-center rounded-xl p-2"
              style={{ left: badgeLeft, bottom: 'calc(100% + 6px)' }}
            >
              <span
                className={cn(
                  'block rounded-full',
                  tool === 'eraser' && 'border-ink border-2 bg-white',
                )}
                style={{ width: realPx, height: realPx, ...inkStyle }}
              />
            </span>
          )}
          <input
            type="range"
            min={BRUSH_MIN}
            max={BRUSH_MAX}
            step={1}
            value={brush}
            onChange={(e) => onBrush(Number(e.target.value))}
            onPointerDown={() => setPressing(true)}
            onPointerUp={() => setPressing(false)}
            onPointerCancel={() => setPressing(false)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label={`${tool === 'eraser' ? '지우개' : '펜'} 굵기`}
            aria-valuetext={`${brush}`}
            className="accent-ink h-9 w-full cursor-pointer"
          />
        </span>
      </label>
    </div>
  );
}
