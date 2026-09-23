import { motion } from 'motion/react';
import { Clock3, Lock } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { PocaGridTile } from './PocaGridTile';
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
  /** 개봉 시각은 지났지만 서버가 카드 풀을 준비 중인 팩 */
  preparing?: boolean;
  onClick: () => void;
}

/**
 * 도감 격자 맨 앞에 놓이는 **안 뜯은 카드팩** 한 칸.
 *
 * 카드들과 같은 격자에 놓입니다 — 목록 밖에 따로 배너처럼 두면 "내 보관함에 있는 것"
 * 으로 안 읽히고 광고로 읽힙니다.
 *
 * 🔴 껍데기(그림 상자 + 이름 띠)는 `PocaGridTile` 이 그립니다. 여기서 직접 그리면
 *    포토카드 칸과 높이가 다시 어긋납니다 — 그게 이 컴포넌트가 고쳐진 이유입니다.
 *
 * 봉지는 살짝 떠 있습니다(`poca-float`). 다른 칸은 가만히 있어서, 움직이는 한 칸이
 * "이건 누를 수 있다" 는 신호가 됩니다.
 *
 * 서버를 모릅니다 — props 로 받은 것만 씁니다. (CLAUDE.md 4-3)
 */
export function PocaPackTile({ count, openAt, preparing = false, onClick }: Props) {
  const locked = !!openAt || preparing;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={locked}
      whileTap={locked ? undefined : { scale: 0.97 }}
      className="block w-full"
    >
      <PocaGridTile
        /* 못 여는 팩은 옅게 — 열 수 있는 팩과 한 격자에 섞여도 구분됩니다 */
        dimmed={locked}
        art={
          /* 🔴 봉지는 `object-contain` 입니다. 포토카드와 달리 2:3 이 아니라서
             `cover` 로 채우면 위아래가 잘립니다. 상자 안쪽에 여백을 줘 테두리에
             닿지 않게 합니다. */
          <img
            src={packUrl}
            alt=""
            draggable={false}
            className="motion-safe:animate-poca-float size-full object-contain p-1.5 drop-shadow-[0_8px_14px_rgba(0,0,0,0.26)]"
          />
        }
        overlay={
          /* 묶음 표시는 **옆 칸과 같은 자리**(오른쪽 위)입니다 — 같은 뜻(몇 개인지)이
             칸마다 다른 자리에 있으면 격자를 훑을 때마다 다시 읽어야 합니다. */
          count !== undefined && count > 1 ? (
            <Badge tone="brand" size="sm" className="absolute top-1 right-1">
              ×{count}
            </Badge>
          ) : undefined
        }
        label={
          <span className="inline-flex items-center gap-1">
            {preparing ? (
              <Clock3 size={11} className="shrink-0" />
            ) : (
              locked && <Lock size={11} className="shrink-0" />
            )}
            카드팩
          </span>
        }
        caption={preparing ? '카드 준비 중' : openAt ? `${packOpenAtLabel(openAt)}부터` : '눌러서 열어보기'}
      />
    </motion.button>
  );
}
