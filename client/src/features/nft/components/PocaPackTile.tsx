import { motion } from 'motion/react';
import { Lock } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import { packOpenAtLabel } from '../model/nft.model';
import packUrl from '@/assets/poca/pack.webp';

interface Props {
  /** 가진 카드팩 수. 여러 개면 몇 개인지 보여줍니다 */
  count?: number;
  /**
   * 아직 못 여는 팩이면 열리는 시각.
   *
   * 🔴 이때는 **누를 수 없습니다.** 눌러도 아무 일이 없는 칸을 두면 연타로 이어집니다 —
   * 대신 언제 열리는지를 칸에 적습니다.
   */
  openAt?: string | null;
  onClick: () => void;
}

/**
 * 내 포카 목록 맨 앞에 놓이는 **안 뜯은 카드팩** 한 칸.
 *
 * 카드들과 같은 격자에 같은 크기로 놓입니다 — 목록 밖에 따로 배너처럼 두면
 * "내 보관함에 있는 것" 으로 안 읽히고 광고로 읽힙니다.
 *
 * 봉지는 살짝 떠 있습니다(`poca-float`). 다른 칸은 가만히 있어서, 움직이는 한 칸이
 * "이건 누를 수 있다" 는 신호가 됩니다.
 *
 * 서버를 모릅니다 — props 로 받은 것만 씁니다. (CLAUDE.md 4-3)
 */
export function PocaPackTile({ count, openAt, onClick }: Props) {
  const locked = !!openAt;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={locked}
      whileTap={locked ? undefined : { scale: 0.97 }}
      className="w-full"
    >
      <div className="surface-2 shadow-list overflow-hidden rounded-2xl">
        <div className="flex items-center justify-center px-6 py-5">
          {/* 카드 한 장과 같은 2:3 자리에 봉지를 담습니다 — 격자의 높이가 어긋나면
              카드팩만 튀어나와 목록이 흐트러집니다. */}
          <div className="relative aspect-[2/3] w-full">
            <img
              src={packUrl}
              alt=""
              draggable={false}
              className={cn(
                'motion-safe:animate-poca-float absolute inset-0 size-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.28)]',
                /* 아직 못 여는 팩은 옅게 — 열 수 있는 팩과 한 격자에 섞여도 구분됩니다 */
                locked && 'opacity-45',
              )}
            />
            {/* 묶음 표시는 **옆 칸과 같은 자리**(그림 오른쪽 위)에 둡니다 — 같은 뜻(몇 개인지)이
                자리마다 다르면 격자를 훑을 때마다 다시 읽어야 합니다.
                🔴 이 칸은 도감(`PocaDexCard`)과 한 격자에 섞입니다. 예전에는 오른쪽 아래였는데,
                   그건 2열 목록에서 `NftCard` 와 나란히 놓일 때의 자리였습니다. */}
            {count !== undefined && count > 1 && (
              <Badge tone="brand" size="sm" className="absolute top-1 right-1">
                ×{count}
              </Badge>
            )}
          </div>
        </div>

        <div className="border-line/70 border-t px-3 py-2.5 text-left">
          <p className="flex items-center gap-1 text-[0.9375rem] leading-snug font-semibold">
            {locked && <Lock size={13} className="shrink-0" />}
            카드팩
          </p>
          <p className="text-subtle mt-1 truncate text-[0.8125rem]">
            {openAt ? `${packOpenAtLabel(openAt)}부터` : '눌러서 열어보기'}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
