import type { ReactNode } from 'react';
import { Armchair, Check, Eye, Gift } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import { copyOriginLabel, copyWhenLabel } from '../model/nft.model';
import type { MyDesignCopy } from '../model/nft.types';

/** 마켓 상태 → 배지. 낱말은 `NftCard`·도감과 같습니다 — 화면마다 다르게 부르지 않습니다 */
function MarketBadge({ copy }: { copy: MyDesignCopy }) {
  if (copy.marketStatus === 'SETTLING') {
    return (
      <Badge tone="quiet" size="sm">
        정산 중
      </Badge>
    );
  }
  if (copy.marketType === 'AUCTION') {
    return (
      <Badge tone="live" size="sm">
        경매 중
      </Badge>
    );
  }
  if (copy.marketType === 'FIXED_PRICE') {
    return (
      <Badge tone="live" size="sm">
        판매 중
      </Badge>
    );
  }
  return null;
}

/** 한 장 — 좌석/출처 + 회차. 목록과 고르기가 같은 줄 모양을 씁니다 */
function CopyRow({ copy, trailing }: { copy: MyDesignCopy; trailing?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      {/* 좌석에서 나온 카드와 뽑기 카드를 아이콘으로 먼저 갈라 줍니다 */}
      <span className="text-ink-muted shrink-0">
        {copy.origin ? <Armchair size={17} /> : <Gift size={17} />}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[0.9375rem] font-semibold">
          {copyOriginLabel(copy)}
        </span>
        <span className="text-subtle block truncate text-[0.8125rem]">{copyWhenLabel(copy)}</span>
      </span>
      {trailing}
    </span>
  );
}

interface ListProps {
  copies: MyDesignCopy[];
  /** 지금 보고 있는 장 — 표시만 하고 누를 수 없습니다(이미 여기입니다) */
  currentPhotocardId: number;
  onOpen: (photocardId: number) => void;
}

/**
 * **같은 도안을 여러 장 가졌을 때의 목록.**
 *
 * 도감은 같은 도안을 한 칸으로 묶어 `×3` 으로 보여주므로, 상세에 들어오면 "내가 가진
 * 그 셋" 이 어디로 갔는지 알 수 없었습니다. 여기서 장마다 좌석·회차를 펼쳐 보여주고,
 * 누르면 그 장의 상세로 갑니다.
 *
 * 🔴 지금 보고 있는 장은 **누를 수 없습니다.** 눌러도 같은 화면이라 "고장난 버튼" 이 됩니다.
 *
 * 서버를 모릅니다 — props 로 받은 것만 그립니다. (CLAUDE.md 4-3)
 */
export function PocaCopyList({ copies, currentPhotocardId, onOpen }: ListProps) {
  return (
    <ul className="divide-line/70 divide-y">
      {copies.map((copy) => {
        const current = copy.photocardId === currentPhotocardId;
        const row = (
          <CopyRow
            copy={copy}
            trailing={
              <span className="flex shrink-0 items-center gap-1.5">
                <MarketBadge copy={copy} />
                {current && (
                  <span className="text-ink-muted inline-flex items-center gap-1 text-xs font-semibold">
                    <Eye size={13} />
                    보는 중
                  </span>
                )}
              </span>
            }
          />
        );

        return (
          <li key={copy.photocardId}>
            {current ? (
              <span className="flex w-full items-center py-2.5">{row}</span>
            ) : (
              <button
                type="button"
                onClick={() => onOpen(copy.photocardId)}
                className="flex w-full items-center py-2.5 text-left"
              >
                {row}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface PickerProps {
  /** 팔 수 있는 장만 넘기세요 (`sellableCopies`) */
  copies: MyDesignCopy[];
  selectedPhotocardId: number | null;
  onSelect: (photocardId: number) => void;
}

/**
 * **어느 장을 팔까** — 판매 폼 안의 고르기.
 *
 * 🔴 같은 그림이어도 파는 것은 **특정한 한 장**입니다. 고르지 않게 두면 화면은 주소창의
 * 장을 팔아 버리는데, 사용자는 목록에서 본 다른 장(다른 좌석·회차)을 팔 생각이었을 수
 * 있습니다. 한 장뿐이어도 무엇을 파는지 보여줍니다 — 값을 적기 전에 확인할 것입니다.
 */
export function PocaCopyPicker({ copies, selectedPhotocardId, onSelect }: PickerProps) {
  return (
    <ul className="space-y-2" role="radiogroup" aria-label="판매할 카드 고르기">
      {copies.map((copy) => {
        const selected = copy.photocardId === selectedPhotocardId;
        return (
          <li key={copy.photocardId}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(copy.photocardId)}
              className={cn(
                'flex w-full items-center rounded-xl border px-3 py-2.5 text-left transition-colors',
                /* 고른 것만 초록입니다 — 지금 선택된 것 (DESIGN.md 1장) */
                selected ? 'border-accent-600 bg-accent-50' : 'border-line surface',
              )}
            >
              <CopyRow
                copy={copy}
                trailing={
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border',
                      selected ? 'border-accent-600 bg-accent-600 text-white' : 'border-line',
                    )}
                  >
                    {selected && <Check size={13} strokeWidth={3} />}
                  </span>
                }
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
