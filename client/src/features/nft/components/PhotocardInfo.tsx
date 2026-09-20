import { Badge } from '@/shared/components/ui';
import { pocaName, photocardSource, mintStatusLabel } from '../model/nft.model';
import type { PhotocardDetail } from '../model/nft.types';
import { pocaRole } from '../model/pocaDraw.model';

export function PhotocardInfo({ card, ownedCount }: { card: PhotocardDetail; ownedCount: number }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl leading-snug font-extrabold break-words">
        {pocaName(card.designName)}
      </h1>
      <p className="text-subtle">{photocardSource(card.performanceTitle, card.eventName)}</p>
      <div className="flex flex-wrap items-center gap-2">
        {card.group && <Badge tone="neutral">{card.group}</Badge>}
        {card.group && <Badge tone="quiet">{pocaRole(card.group, card.grade)}</Badge>}
        {mintStatusLabel(card.status) && <Badge tone="quiet">{mintStatusLabel(card.status)}</Badge>}
      </div>
      {ownedCount > 1 && <p className="text-muted text-sm">이 카드 {ownedCount}장 보유</p>}
      <p className="text-subtle text-sm">소유자 {card.ownerNickname}</p>
    </div>
  );
}
