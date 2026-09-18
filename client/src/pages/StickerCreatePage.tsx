import { useNavigate } from 'react-router-dom';
import { Images, RefreshCw, Sparkles, Undo2 } from 'lucide-react';
import { useModal } from '@/app/providers';
import { BottomBar, Header } from '@/shared/components/layout';
import { Button } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import {
  BrushBar,
  DrawCanvas,
  StickerResult,
  useStickerCanvas,
  useStickerMaker,
  useStickerQuota,
} from '@/features/sticker';

/**
 * 포카 꾸미기 — 그리기 → 만들기 → 결과.
 *
 * 설계 5장 ③ "하단 고정 버튼이 있는 화면". 페이지는 조립만 합니다 (CLAUDE.md 3-6):
 * 그리기는 `useStickerCanvas` + `DrawCanvas`, 만들기는 `useStickerMaker` + `StickerResult`.
 *
 * 같은 정사각형 자리에 **그리기 판**과 **결과 판**이 번갈아 들어갑니다 — 화면을 옮기지 않아서
 * "다시 그리기" 를 눌러도 방금 그린 그림이 그대로 있습니다 (drawStore 가 들고 있음).
 */
export function StickerCreatePage() {
  const navigate = useNavigate();
  const canvas = useStickerCanvas();
  const maker = useStickerMaker();
  const quota = useStickerQuota();
  const { open } = useModal();

  const remaining = quota.data?.remaining;
  const exhausted = remaining === 0;
  const showingResult = maker.jobId !== null || maker.busy;
  const done = maker.job?.status === 'DONE';

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
          {!showingResult
            ? '대충 그려도 괜찮아요. 칠한 색은 스티커에도 남고, AI 가 모양을 다듬어 줍니다.'
            : done
              ? '마음에 들면 그대로 두고, 아니면 다시 만들어 보세요.'
              : maker.failed
                ? '이번 시도는 실패했어요. 다시 만들기를 눌러 한 번 더 해 보세요.'
                : '낙서를 스티커로 바꾸는 중이에요. 6초쯤 걸려요.'}
        </p>

        {showingResult ? (
          <StickerResult job={maker.job} sketchUrl={maker.sketchUrl} />
        ) : (
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
        )}

        <BottomBar.Spacer />
      </div>

      <BottomBar>
        {/* 오늘 몫 — 상한(5장)이 있으니 누르기 전에 알려줍니다 */}
        {remaining !== undefined && (
          <p className="text-muted mb-2 text-center text-xs tabular-nums">
            {exhausted ? '오늘 만들 수 있는 스티커를 다 썼어요' : `오늘 ${remaining}장 더 만들 수 있어요`}
          </p>
        )}

        {!showingResult ? (
          /* 거래가 아니라 이 화면의 주 행동 → dark (Button 주석의 "언제 무엇을 쓰나") */
          <Button
            variant="dark"
            size="lg"
            fullWidth
            leftIcon={<Sparkles size={18} />}
            disabled={!canvas.hasInk || exhausted}
            loading={maker.busy}
            onClick={() => maker.start(canvas.strokes)}
          >
            스티커 만들기
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                leftIcon={<Undo2 size={18} />}
                disabled={maker.busy}
                onClick={maker.reset}
              >
                다시 그리기
              </Button>
              <Button
                variant="dark"
                size="lg"
                className="flex-1"
                leftIcon={<RefreshCw size={18} />}
                loading={maker.busy}
                disabled={exhausted}
                onClick={() => maker.start(canvas.strokes)}
              >
                다시 만들기
              </Button>
            </div>
            {done && (
              <Button
                variant="ghost"
                size="md"
                fullWidth
                leftIcon={<Images size={16} />}
                onClick={() => navigate(ROUTES.MY_STICKERS)}
              >
                내 스티커 보기
              </Button>
            )}
          </div>
        )}
      </BottomBar>
    </>
  );
}
