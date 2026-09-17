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
/**
 * 이 칸이 "지금 어디 있나" — 마켓에 올라간 장이 하나라도 있으면 판매 중으로 봅니다.
 *
 * 🔴 **점의 색·자리는 `NftCard` 와 같습니다.** 같은 뜻을 두 화면에서 다르게 그리면
 *    사용자가 두 번 배워야 합니다. 다만 도감은 우상단을 ×N 배지가 쓰므로 **좌상단**입니다.
 *
 * 색만으로는 뜻이 전해지지 않으므로(색각 이상 · 2.5px 짜리 점) 손을 올리면 글이 나오고,
 * 스크린리더에는 항상 읽힙니다.
 */
function StateDot({ count, listedCount }: { count: number; listedCount: number }) {
  const listed = listedCount > 0;
  /* 섞여 있으면 몇 장이 올라가 있는지까지 알려줍니다 — "3장 중 1장" 은 점만으로는 못 셉니다 */
  const label = !listed
    ? '보관 중 — 내 보관함에만 있어요.'
    : count > listedCount
      ? count + '장 중 ' + listedCount + '장 판매 중 — 나머지는 보관함에 있어요.'
      : '판매 중 — 마켓에 올라가 있어요.';

  return (
    <span title={label} className="absolute top-1 left-1 flex items-center">
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        className={cn(
          'size-2.5 rounded-full',
          listed
            ? 'bg-danger shadow-[0_0_0_3px_var(--color-danger-soft)]'
            : 'bg-accent-600 shadow-[0_0_0_3px_var(--color-accent-50)]',
        )}
      />
    </span>
  );
}

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

        {/* 안 가진 칸에는 붙이지 않습니다 — 없는 카드의 "보관 중" 은 뜻이 없습니다 */}
        {owned && <StateDot count={entry.count} listedCount={entry.listedCount} />}

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
