import { cn } from '@/shared/lib';
import { RARITY_LABEL, RARITY_STYLE } from '../model/nft.model';
import type { Rarity } from '../model/nft.types';

interface Props {
  rarity: Rarity;
  className?: string;
}

/**
 * 등급 뱃지.
 *
 * 공용 `Badge` 는 무채색 톤(neutral/success/...)만 압니다.
 * 등급 색은 포카 전용이라 여기서 `RARITY_STYLE` 을 그대로 씁니다 —
 * 색을 바꾸려면 `nft.model.ts` 의 테이블 한 줄만 고치면 됩니다.
 */
export function RarityBadge({ rarity, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5',
        'text-[0.625rem] font-bold tracking-wide',
        RARITY_STYLE[rarity].badge,
        className,
      )}
    >
      {RARITY_LABEL[rarity]}
    </span>
  );
}
