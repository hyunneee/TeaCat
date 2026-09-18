import type { ReactNode } from 'react';
import { cn } from '@/shared/lib';

interface Props {
  /** 그림 자리에 들어갈 것. 2:3 상자는 **여기가** 잡아 주므로 안쪽은 `size-full` 만 쓰면 됩니다 */
  art: ReactNode;
  /** 그림 위에 얹는 것 — 배지·상태 점. 상자가 `relative` 라 `absolute` 로 바로 붙습니다 */
  overlay?: ReactNode;
  /** 띠 첫째 줄 — 카드 이름, 또는 "카드팩" */
  label: ReactNode;
  /** 띠 둘째 줄 — 소속, 또는 "눌러서 열어보기". 없으면 첫째 줄이 띠 가운데로 옵니다 */
  caption?: ReactNode;
  /** 못 여는 카드팩처럼 흐리게 둘 때 */
  dimmed?: boolean;
  className?: string;
}

/**
 * **도감 격자의 한 칸** — 그림 + 이름 띠.
 *
 * ── 🔴 이 컴포넌트가 있는 이유는 "높이" 입니다 ─────────────────
 * 도감 격자에는 두 종류의 칸이 섞입니다 — 포토카드(`PocaDexCard`)와
 * 카드팩(`PocaPackTile`). 예전에는 각자 그렸고, 카드팩만 회색 상자와 두 줄 글을 가져서
 * **칸 높이가 11px 씩 어긋났습니다.** 격자에서 높이가 어긋나면 줄이 들쭉날쭉해 보이고,
 * 사용자에게는 "카드팩이 카드보다 큰 것" 으로 읽힙니다 (QA 지적).
 *
 * 그래서 두 칸이 **같은 껍데기**를 씁니다. 높이를 숫자로 맞추지 않고 구조로 맞춥니다 —
 * 한쪽 글자 크기를 바꿔도 다시 어긋나지 않습니다.
 *
 * ── 띠는 왜 고정 높이인가 ──────────────────────────────────
 * 카드팩에는 둘째 줄이 꼭 필요합니다(언제 열리는지). 포토카드에는 소속이 있지만 없는
 * 도안도 있습니다. 줄 수에 따라 띠가 늘었다 줄면 그 순간 다시 높이가 어긋나므로,
 * 띠는 `h-11` 로 두고 안에서 **가운데 맞춤**합니다. 한 줄만 있으면 그 줄이 가운데로 옵니다.
 *
 * 서버를 모릅니다 — props 로 받은 것만 그립니다. (CLAUDE.md 4-3)
 */
export function PocaGridTile({ art, overlay, label, caption, dimmed, className }: Props) {
  return (
    <div className={cn('surface-2 shadow-list overflow-hidden rounded-xl', className)}>
      {/* 2:3 은 여기서 한 번만 정합니다. 안쪽이 각자 정하면 또 어긋납니다 */}
      <div className="relative aspect-[2/3] w-full">
        {/* 🔴 흐리게 하는 것은 **그림만** 입니다. 상자째로 흐리면 위에 얹은 배지(×3)까지
            같이 옅어지는데, 못 여는 팩이 몇 개인지는 흐려져선 안 되는 정보입니다. */}
        <div className={cn('size-full', dimmed && 'opacity-45')}>{art}</div>
        {overlay}
      </div>

      <div className="border-line/70 flex h-11 flex-col justify-center border-t px-2">
        <p className="truncate text-center text-xs leading-tight font-semibold">{label}</p>
        {caption && (
          <p className="text-subtle mt-0.5 truncate text-center text-[0.6875rem] leading-tight">
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}
