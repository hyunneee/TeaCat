import { HelpCircle } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import { PocaArt } from './PocaArt';
import { pocaSeed } from '../model/nft.model';
import type { PocaDexEntry } from '../model/pocaDex.model';

interface Props {
  entry: PocaDexEntry;
  /** 가진 카드만 누를 수 있습니다 — 없는 카드는 열 상세가 없습니다 */
  onOpen: (photocardId: number) => void;
}

/**
 * 도감 한 칸.
 *
 * ── 🔴 안 가진 칸은 **그림을 받지 않습니다** ──────────────────
 * 흐리게 처리해서 가릴 수도 있지만, 그러면 (1) 개발자도구로 흐림만 걷으면 그림이 그대로
 * 보이고 (2) 아직 없는 카드 수십 장의 그림을 IPFS 게이트웨이에서 **전부 받아옵니다.**
 * 도감은 안 가진 칸이 대부분인 화면이라 그 비용이 큽니다. 그래서 아예 요청하지 않고
 * 물음표만 그립니다 — 무엇이 남았는지는 세어 보면 알고, 무엇인지는 모아야 압니다.
 *
 * ⚠️ 대신 안 가진 칸은 **모양으로도 구분되지 않습니다.** 그게 도감의 재미이기도 하지만,
 * "어떤 카드가 남았는지 힌트라도" 라는 요구가 오면 이름만 여는 쪽부터 검토하세요.
 */
export function PocaDexCard({ entry, onOpen }: Props) {
  const owned = entry.count > 0;

  const art = owned ? (
    <PocaArt
      seed={pocaSeed(entry.designId)}
      imageUrl={entry.imageUrl}
      alt={`${entry.name} 포토카드`}
      className="shadow-card"
    />
  ) : (
    /* 카드 자리를 그대로 차지합니다 — 비워 두면 격자가 무너져 "몇 칸 남았나" 가 안 보입니다 */
    <div
      role="img"
      aria-label="아직 모으지 못한 카드"
      className="surface-2 border-line text-ink-subtle flex aspect-[2/3] w-full items-center justify-center rounded-lg border border-dashed"
    >
      <HelpCircle size={26} strokeWidth={1.5} />
    </div>
  );

  const content = (
    <>
      <div className="relative">
        {art}

        {/* 🔴 여러 장 가졌을 때만. ×1 은 아무것도 알려주지 않으면서 칸마다 배지를 붙입니다 */}
        {entry.count > 1 && (
          <Badge tone="brand" size="sm" className="absolute top-1 right-1">
            ×{entry.count}
          </Badge>
        )}
      </div>

      <p
        className={cn('mt-1.5 truncate text-center text-xs font-semibold', !owned && 'text-subtle')}
      >
        {owned ? entry.name : '???'}
      </p>
    </>
  );

  /* 누를 수 없는 것을 버튼으로 만들지 않습니다 — 눌러도 아무 일 없는 버튼은
     "고장난 화면" 으로 읽힙니다 (PocaShowcase 와 같은 규칙) */
  if (!owned || entry.photocardId === null) {
    return <div className="w-full opacity-70">{content}</div>;
  }

  const photocardId = entry.photocardId;
  return (
    <button type="button" onClick={() => onOpen(photocardId)} className="w-full text-left">
      {content}
    </button>
  );
}
