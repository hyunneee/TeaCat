import { Sparkles } from 'lucide-react';
import { useModal } from '@/app/providers';
import { BottomBar, Header } from '@/shared/components/layout';
import { Button } from '@/shared/components/ui';
import { toast } from '@/shared/stores';
import { BrushBar, DrawCanvas, useStickerCanvas } from '@/features/sticker';

/**
 * 포카 꾸미기 — 그리기 화면.
 *
 * 설계 5장 ③ "하단 고정 버튼이 있는 화면": 머리말 · 그림판 · 도구 줄 · 만들기 버튼.
 * 페이지는 조립만 합니다 (CLAUDE.md 3-6) — 상태는 `useStickerCanvas`, 그리기는 `DrawCanvas`.
 *
 * 1단계(캔버스만): 만들기 버튼은 자리만 있고 다음 단계에서 생성 요청에 연결합니다.
 */
export function StickerCreatePage() {
  const canvas = useStickerCanvas();
  const { open } = useModal();

  /* 전부 지우기는 되돌릴 수 없는 동작 → 확인 모달 (CLAUDE.md 4-7) */
  const confirmClear = () =>
    open('common/confirm', {
      title: '그림을 전부 지울까요?',
      message: '지운 그림은 되돌릴 수 없어요.',
      confirmText: '지우기',
      danger: true,
      onConfirm: canvas.clear,
    });

  return (
    <>
      <Header title="포카 꾸미기" showBack />

      <div className="space-y-4 p-4">
        <p className="text-muted text-sm">
          대충 그려도 괜찮아요. 칠한 색은 스티커에도 남고, AI 가 모양을 다듬어 줍니다.
        </p>

        {/* 도구는 캔버스 **안에** 떠 있습니다 — 손이 덜 움직이고 캔버스를 크게 씁니다 */}
        <DrawCanvas
          canvasRef={canvas.canvasRef}
          cursorRef={canvas.cursorRef}
          handlers={canvas.handlers}
          empty={!canvas.hasInk}
          erasing={canvas.tool === 'eraser'}
          eraserPx={canvas.eraserPx}
        >
          <BrushBar
            tool={canvas.tool}
            brush={canvas.brush}
            canvasSize={canvas.canvasSize}
            color={canvas.color}
            palette={canvas.palette}
            canUndo={canvas.canUndo}
            onTool={canvas.setTool}
            onBrush={canvas.setBrush}
            onColor={canvas.setColor}
            onAddColor={canvas.addColor}
            onUndo={canvas.undo}
            onClear={confirmClear}
          />
        </DrawCanvas>

        <BottomBar.Spacer />
      </div>

      <BottomBar>
        {/* 거래가 아니라 이 화면의 주 행동 → dark (Button 주석의 "언제 무엇을 쓰나") */}
        <Button
          variant="dark"
          size="lg"
          fullWidth
          leftIcon={<Sparkles size={18} />}
          disabled={!canvas.hasInk}
          onClick={() => toast.info('만들기는 다음 단계에서 연결됩니다')}
        >
          스티커 만들기
        </Button>
      </BottomBar>
    </>
  );
}
