import { Sparkles } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { Loading } from '@/shared/components/common';
import { cn } from '@/shared/lib';
import type { Sticker } from '@/features/sticker';
import { PLACED_MAX_COUNT } from '../model/decoration.types';

interface Props {
  /** 내 스티커. `useMyStickers()` 의 결과를 페이지가 내려줍니다 (CLAUDE.md 4-3) */
  stickers: Sticker[] | undefined;
  isPending: boolean;
  isError: boolean;
  /** 지금 카드에 얹혀 있는 개수 */
  placedCount: number;
  onPick: (sticker: Sticker) => void;
  /** 스티커 만들기 화면으로 */
  onCreate: () => void;
  className?: string;
}

/**
 * 꾸미기 화면 아래의 스티커 서랍 — 탭하면 카드 가운데에 한 장 올라갑니다.
 *
 * 가로 한 줄입니다. 격자로 펼치면 카드가 가려져서, 지금 무엇을 꾸미고 있는지가 안 보입니다.
 * 상한(20장)에 닿으면 **탭을 막고 이유를 말합니다** — 눌렀는데 아무 일도 없으면 고장으로 읽힙니다.
 */
export function StickerDrawer({
  stickers,
  isPending,
  isError,
  placedCount,
  onPick,
  onCreate,
  className,
}: Props) {
  const full = placedCount >= PLACED_MAX_COUNT;

  if (isPending) return <Loading label="스티커를 불러오는 중" className={className} />;

  if (isError) {
    return (
      <p className={cn('text-subtle py-3 text-center text-sm', className)}>
        스티커를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  if (!stickers || stickers.length === 0) {
    return (
      <div className={cn('flex items-center justify-between gap-3 py-1', className)}>
        <p className="text-subtle text-sm">아직 만든 스티커가 없어요</p>
        <Button variant="soft" size="sm" leftIcon={<Sparkles size={15} />} onClick={onCreate}>
          스티커 만들기
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-subtle text-sm font-semibold">
          {full ? `스티커는 ${PLACED_MAX_COUNT}장까지예요` : '눌러서 카드에 붙여요'}
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="text-accent-700 text-sm font-semibold underline-offset-2 hover:underline"
        >
          스티커 만들기
        </button>
      </div>

      {/* 가로 스크롤 한 줄. `overflow-x-auto` 라 손가락 좌우 스와이프가 그대로 먹습니다 */}
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {stickers.map((s) => (
          <li key={s.id} className="shrink-0">
            <button
              type="button"
              disabled={full}
              onClick={() => onPick(s)}
              aria-label="이 스티커 붙이기"
              className={cn(
                'border-line block size-16 overflow-hidden rounded-xl border transition',
                full ? 'opacity-40' : 'active:scale-95',
              )}
              style={{
                background:
                  'repeating-conic-gradient(var(--color-surface-2) 0 25%, white 0 50%) 0 0 / 12px 12px',
              }}
            >
              <img
                src={s.imageUrl}
                alt=""
                loading="lazy"
                draggable={false}
                className="h-full w-full object-contain"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
