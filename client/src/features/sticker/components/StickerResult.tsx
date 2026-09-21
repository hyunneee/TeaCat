import { AlertTriangle } from 'lucide-react';
import { Spinner } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import type { StickerJob } from '../model/sticker.types';

interface StickerResultProps {
  /** null 이면 아직 요청 응답 전(업로드 중) */
  job: StickerJob | null;
  /** 내가 그린 낙서 (data URL). 기다리는 동안 흐리게 깔아 둡니다 */
  sketchUrl: string | null;
  className?: string;
}

/**
 * 결과 판 — 캔버스 자리에 그대로 들어갑니다 (같은 정사각형).
 *
 * - 기다리는 동안: 낙서를 크게 보여주고 위에 스피너. "빈 화면에 스피너" 보다 무엇을 만드는 중인지 보입니다.
 * - 끝나면: 스티커만 크게. 투명 배경이 보이게 체크무늬 바탕.
 *   (낙서 썸네일을 왼쪽 아래에 두었다가 뺐습니다 — 사용자 요청. 낙서는 기다리는 동안만 보입니다)
 * - 실패: 이유 대신 사람 말로. 다시 만들기는 하단 버튼이 맡습니다.
 *
 * 그리기만 합니다 — 무엇을 다시 할지는 페이지가 정합니다 (CLAUDE.md 4-3).
 */
export function StickerResult({ job, sketchUrl, className }: StickerResultProps) {
  const waiting = !job || job.status === 'PENDING' || job.status === 'RUNNING';
  const failed = job?.status === 'FAILED';
  const image = job?.sticker?.imageUrl;

  return (
    <div
      className={cn(
        'border-line-strong shadow-card relative aspect-square w-full overflow-hidden rounded-2xl border-2',
        className,
      )}
      style={{
        /* 투명 PNG 가 어디까지인지 보이게 하는 체크무늬. 색이 아니라 명도만 씁니다 */
        background:
          'repeating-conic-gradient(var(--color-surface-2) 0 25%, white 0 50%) 0 0 / 24px 24px',
      }}
    >
      {waiting && (
        <>
          {sketchUrl && (
            <img src={sketchUrl} alt="" className="absolute inset-0 h-full w-full object-contain opacity-30" />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Spinner />
            <p className="text-muted text-sm">
              {job?.status === 'RUNNING' ? '스티커를 그리고 있어요' : '순서를 기다리고 있어요'}
            </p>
          </div>
        </>
      )}

      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <AlertTriangle className="text-danger" size={28} />
          <p className="text-ink font-bold">이번엔 잘 안 됐어요</p>
          <p className="text-muted text-sm">낙서를 조금 더 크게 그리거나, 다시 만들기를 눌러 보세요.</p>
        </div>
      )}

      {image && (
        <img src={image} alt="만들어진 스티커" className="absolute inset-0 h-full w-full object-contain" />
      )}
    </div>
  );
}
