import { HelpCircle } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import cardBackUrl from '@/assets/poca/card-back.webp';
import { PocaArt } from './PocaArt';
import { PocaGridTile } from './PocaGridTile';
import { pocaSeed } from '../model/nft.model';
import type { PocaDexEntry, PocaDexMarketState } from '../model/pocaDex.model';

interface Props {
  entry: PocaDexEntry;
  /** 가진 카드만 누를 수 있습니다 — 없는 카드는 열 상세가 없습니다 */
  onOpen: (photocardId: number) => void;
}

/** 마켓 상태 → 점 색과 사람 말. 낱말은 `NftCard` 의 배지와 같습니다 */
const MARKET_WORD: Record<PocaDexMarketState, string> = {
  LISTED: '판매 중',
  AUCTION: '경매 중',
  SETTLING: '정산 중',
};

/**
 * 이 칸이 "지금 어디 있나" — 마켓에 나간 장이 하나라도 있으면 그 상태를 말합니다.
 *
 * ── 🔴 왜 글자가 아니라 점인가 ────────────────────────────────
 * `NftCard` 는 같은 뜻을 **글자 배지**로 보여줍니다. 도감은 2/3/5열 격자로,
 * 좁은 칸에 "판매 중" 배지와 `×N` 배지를 함께 올리면 그림이 배지에
 * 덮입니다. 그래서 **모양만** 점으로 줄이고 **낱말은 그대로** 씁니다(`MARKET_WORD`) —
 * 거기서 "경매 중" 인 카드가 여기서 "판매 중" 이면 거짓말이 됩니다.
 *
 * 자리는 좌상단입니다. 우상단은 `×N` 배지가 씁니다.
 *
 * 색만으로는 뜻이 전해지지 않으므로(색각 이상 · 2.5px 짜리 점) 손을 올리면 글이 나오고,
 * 스크린리더에는 항상 읽힙니다.
 */
function StateDot({
  count,
  marketCount,
  marketState,
}: {
  count: number;
  marketCount: number;
  marketState: PocaDexMarketState | null;
}) {
  const word = marketState ? MARKET_WORD[marketState] : null;
  /* 섞여 있으면 몇 장이 나가 있는지까지 알려줍니다 — "3장 중 1장" 은 점만으로는 못 셉니다 */
  const label =
    word === null
      ? '보관 중 — 내 보관함에만 있어요.'
      : count > marketCount
        ? count + '장 중 ' + marketCount + '장 ' + word + ' — 나머지는 보관함에 있어요.'
        : word + ' — 마켓에 올라가 있어요.';

  return (
    <span title={label} className="absolute top-1 left-1 flex items-center">
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        className={cn(
          'size-2.5 rounded-full',
          /* 정산 중은 내 손을 떠난 상태라 "지금 뭘 할 수 있다" 는 신호를 주지 않습니다 */
          marketState === 'SETTLING'
            ? 'bg-ink-subtle shadow-[0_0_0_3px_var(--color-surface-2)]'
            : word !== null
              ? 'bg-danger shadow-[0_0_0_3px_var(--color-danger-soft)]'
              : 'bg-accent-600 shadow-[0_0_0_3px_var(--color-accent-50)]',
        )}
      />
    </span>
  );
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
 * 안 가진 칸도 획득처는 표시합니다. 카드의 정체는 숨기면서 어느 공연이나 이벤트 팩을
 * 확인해야 하는지는 알 수 있어야 하기 때문입니다.
 *
 * 껍데기(그림 상자 + 이름 띠)는 `PocaGridTile` 이 그립니다 — 카드팩 칸과 높이를
 * 구조로 맞추기 위해서입니다(그 주석 참고).
 */
export function PocaDexCard({ entry, onOpen }: Props) {
  const owned = entry.count > 0;
  const acquisition =
    entry.acquisitions.map((source) => source.type === 'PERFORMANCE' ? `공연 · ${source.name}` : source.name).join(', ') || '획득처 준비 중';

  const tile = (
    <PocaGridTile
      art={
        owned ? (
          <PocaArt
            seed={pocaSeed(entry.templateId)}
            imageUrl={entry.imageUrl}
            alt={`${entry.name} 포토카드`}
            className="size-full rounded-none"
          />
        ) : (
          /*
           * 안 가진 칸 — **카드 뒷면**을 깔고 그 위에 물음표를 얹습니다.
           *
           * 빈 상자에 물음표만 두면 "아직 안 불러온 칸" 처럼 보입니다. 뒷면을 깔면
           * 엎어 둔 카드가 되어, 모으면 뒤집힌다는 것이 그림만으로 전해집니다.
           *
           * 🔴 앞면(`imageUrl`)은 여전히 **요청하지 않습니다.** 뒷면은 모든 카드가
           *    같은 그림이고 앱에 함께 묻혀 오는 파일이라, 아직 없는 카드 수십 장을
           *    IPFS 게이트웨이에서 받아오는 것과는 다릅니다 — 새는 정보도 없습니다.
           */
          <div role="img" aria-label="아직 모으지 못한 카드" className="relative size-full">
            <img src={cardBackUrl} alt="" draggable={false} className="size-full object-cover" />
            {/* 뒷면 무늬 위에서도 물음표가 읽혀야 합니다 — 어두운 판을 한 겹 깔고 흰 선으로 */}
            <span className="absolute inset-0 flex items-center justify-center">
              {/* 🔴 여기에 backdrop-filter 를 쓰지 않습니다. 도감은 칸이 수십 개인 화면이고,
                  backdrop-filter 는 칸마다 합성 레이어를 만듭니다 — 모달 깜빡임의 원인이
                  그것이었습니다(Modal.tsx 주석). 불투명한 판 하나로 충분합니다. */}
              <span className="flex size-9 items-center justify-center rounded-full bg-black/45 text-white">
                <HelpCircle size={22} strokeWidth={2} />
              </span>
            </span>
          </div>
        )
      }
      overlay={
        owned ? (
          <>
            <StateDot
              count={entry.count}
              marketCount={entry.marketCount}
              marketState={entry.marketState}
            />
            {/* 🔴 여러 장 가졌을 때만. ×1 은 아무것도 알려주지 않으면서 칸마다 배지를 붙입니다 */}
            {entry.count > 1 && (
              <Badge tone="brand" size="sm" className="absolute top-1 right-1">
                ×{entry.count}
              </Badge>
            )}
          </>
        ) : undefined
      }
      label={owned ? entry.name : '???'}
      /* 앞면은 숨겨도 어디에서 얻는 카드는 알려 줍니다. 공연명은 공개된 공연만 응답됩니다. */
      caption={<span title={`획득처: ${acquisition}`}>{acquisition}</span>}
    />
  );

  /* 누를 수 없는 것을 버튼으로 만들지 않습니다 — 눌러도 아무 일 없는 버튼은
     "고장난 화면" 으로 읽힙니다 (PocaShowcase 와 같은 규칙) */
  if (!owned || entry.photocardId === null) {
    return <div className="w-full opacity-70">{tile}</div>;
  }

  const photocardId = entry.photocardId;
  return (
    <button type="button" onClick={() => onOpen(photocardId)} className="block w-full text-left">
      {tile}
    </button>
  );
}
