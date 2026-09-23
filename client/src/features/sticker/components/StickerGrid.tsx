import { Trash2 } from 'lucide-react';
import { IconButton } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import type { Sticker } from '../model/sticker.types';

interface StickerGridProps {
  stickers: Sticker[];
  onDelete: (sticker: Sticker) => void;
  /** 지우는 중인 것 — 버튼을 잠깐 막습니다 */
  deletingId?: number | null;
  className?: string;
}

/**
 * 내 스티커 격자. 3열, 정사각, 투명 배경이 보이게 체크무늬.
 * 삭제는 붉은 아이콘 하나 — 되돌릴 수 없는 동작이라 확인 모달은 페이지가 띄웁니다 (CLAUDE.md 4-7).
 */
export function StickerGrid({ stickers, onDelete, deletingId, className }: StickerGridProps) {
  return (
    <ul className={cn('grid grid-cols-3 gap-3', className)}>
      {stickers.map((s) => (
        <li
          key={s.id}
          className="border-line relative aspect-square overflow-hidden rounded-2xl border"
          style={{
            background:
              'repeating-conic-gradient(var(--color-surface-2) 0 25%, white 0 50%) 0 0 / 16px 16px',
          }}
        >
          <img
            src={s.imageUrl}
            alt="내 스티커"
            className={cn('h-full w-full object-contain', s.used && 'opacity-40 grayscale')}
            loading="lazy"
          />

          {/* 🔴 쓴 스티커는 **되돌릴 수 없습니다.** 왜 못 쓰는지 화면이 말해 줘야 합니다 —
              안 그러면 "왜 서랍에 안 보이지?" 가 됩니다 (2026-09-23) */}
          {s.used && (
            <span className="bg-ink/70 absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white">
              사용됨
            </span>
          )}
          <IconButton
            label="스티커 지우기"
            variant="danger-ghost"
            size="sm"
            className="absolute top-1.5 right-1.5"
            disabled={deletingId === s.id}
            onClick={() => onDelete(s)}
          >
            <Trash2 size={15} />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}
