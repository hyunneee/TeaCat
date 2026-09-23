import { cn } from '@/shared/lib';
import { FRUITS } from '../model/halliGalliTable';
import type { HalliGalliCard } from '../model/game.types';

interface Props {
  card: HalliGalliCard | undefined;
  /** 카드가 없을 때 뭐라고 할지 — 탈락인지, 아직 안 냈는지 */
  emptyLabel?: string;
  className?: string;
}

/**
 * 펼쳐 놓은 카드 한 장.
 *
 * 🔴 **개수를 숫자로 적지 않고 과일을 그 수만큼 그립니다.** 이 게임은 눈으로 세는 것이
 * 규칙의 전부라, "바나나 3" 이라고 적어 주면 세는 일을 화면이 대신해 버립니다.
 * 종을 칠지 말지는 사람이 판단해야 합니다.
 *
 * 1~5개를 한 칸에 담아야 해서 **개수마다 배치를 다르게** 둡니다. 다섯 개를 한 줄로
 * 늘어놓으면 카드가 옆으로 길어지고, 격자로 깔면 하나가 외톨이로 남습니다.
 */
export function FruitCard({ card, emptyLabel = '없음', className }: Props) {
  if (!card) {
    return (
      <div
        className={cn(
          'surface-2 border-border text-subtle flex items-center justify-center rounded-xl border border-dashed text-[11px]',
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  const fruit = FRUITS[card.fruit];
  const Icon = fruit.icon;

  return (
    <div
      className={cn(
        'surface border-border flex items-center justify-center rounded-xl border p-1.5 shadow-sm',
        className,
      )}
      /* 화면 낭독기에는 숫자로 알려 줍니다 — 눈으로 세는 재미는 보는 사람의 몫이고,
         못 보는 사람에게까지 세라고 할 수는 없습니다 */
      aria-label={`${fruit.label} ${card.count}개`}
    >
      <div
        className={cn(
          'flex flex-wrap items-center justify-center gap-0.5',
          /* 3개는 2+1, 5개는 3+2 로 앉도록 폭을 잡습니다 */
          card.count === 3 && 'max-w-[calc(2*1.5rem)]',
          card.count >= 4 && 'max-w-[calc(3*1.5rem)]',
        )}
        aria-hidden
      >
        {Array.from({ length: card.count }, (_, i) => (
          <Icon key={i} className={cn('size-5 shrink-0', fruit.tone)} strokeWidth={2.2} />
        ))}
      </div>
    </div>
  );
}
