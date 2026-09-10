import { motion } from 'motion/react';
import { cn } from '@/shared/lib';
import { Badge } from '@/shared/components/ui';
import { PocaArt } from './PocaArt';
import { pocaSeed } from '../model/nft.model';

interface Props {
  photocardId: number;
  designName: string;
  imageUrl: string | null;
  performanceTitle: string;
  /** 판매가(CAT). 없으면 `caption` 을 셋째 줄에 보인다 */
  price?: number | null;
  /** 가격이 없을 때 셋째 줄 — '보관 중' · '판매 중' 등 */
  caption?: string;
  /** 같은 도안을 여러 장 가졌을 때의 장수. 1 이하면 아무것도 안 보입니다 */
  count?: number;
  /**
   * 내 카드의 상태 — 카드 모서리에 **점**으로만 표시합니다.
   * 초록은 보관 중, 붉은 점은 마켓에 올라가 있다는 뜻입니다.
   * 색만으로 뜻이 전해지지 않으므로(색각 이상·작은 점) 눌러 보거나 손을 올리면
   * 무슨 상태인지 글로 나옵니다.
   */
  state?: 'STORED' | 'LISTED';
  onClick: () => void;
}

/**
 * 마켓·컬렉션·홈·검색의 포카 한 장.
 *
 * 호출처마다 타입이 다릅니다(`MarketPhotocard`, `MyPhotocard`). 그래서 타입을 받지 않고
 * **그릴 값만** 받습니다. 목업을 지우고 서버 타입이 바뀌어도 이 컴포넌트는 그대로입니다.
 *
 * ── 테두리를 두르지 않습니다 ───────────────────────────────
 * 카드가 격자로 여러 장 깔리면 테두리끼리 선이 겹쳐 화면이 지저분해집니다.
 * **연회색 면**만 깔고, 그 위에 카드를 여백을 두고 올립니다.
 * 면과 면 사이의 흰 여백이 곧 구분선 역할을 합니다.
 *
 * 글자는 셋뿐입니다 — 이름 · 공연 · 가격. 가격이 가장 큽니다.
 */
export function NftCard({
  photocardId,
  designName,
  imageUrl,
  performanceTitle,
  price,
  caption,
  count,
  state,
  onClick,
}: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="w-full text-left"
    >
      {/* 그림과 글자를 **하나의 면**에 담습니다 — 상자가 둘로 나뉘어 있으면
          격자에서 어느 글자가 어느 그림의 것인지 한눈에 안 붙습니다.
          바탕과 면의 밝기 차가 작아서 그림자(`shadow-list`)가 없으면 격자가 번져 보입니다. */}
      <div className="surface-2 shadow-list overflow-hidden rounded-2xl">
        <div className="relative flex items-center justify-center px-6 py-5">
          {/* 묶음 표시는 **카드 그림 기준**으로 붙입니다 — 바깥 상자에 붙이면
              여백 때문에 카드에서 떨어진 허공에 뜬 것처럼 보입니다. */}
          <div className="relative w-full">
            <PocaArt
              seed={pocaSeed(photocardId)}
              imageUrl={imageUrl}
              alt={`${designName} 포토카드`}
              className="shadow-card"
            />
            {count !== undefined && count > 1 && (
              <Badge tone="brand" size="sm" className="absolute right-1 bottom-1">
                ×{count}
              </Badge>
            )}
          </div>

          {/* 상태 점 — 글자 대신 빛 하나. 자세한 뜻은 눌렀을 때(title) 나옵니다 */}
          {state && (
            <span
              title={
                state === 'LISTED'
                  ? '판매 중 — 마켓에 올라가 있어요. 지금은 다른 사람이 살 수 있습니다.'
                  : '보관 중 — 내 보관함에만 있어요. 아직 마켓에 올리지 않았습니다.'
              }
              className="absolute top-2 right-2 flex items-center"
            >
              <span className="sr-only">{state === 'LISTED' ? '판매 중' : '보관 중'}</span>
              <span
                aria-hidden
                className={cn(
                  'size-2.5 rounded-full',
                  state === 'LISTED'
                    ? 'bg-danger shadow-[0_0_0_3px_var(--color-danger-soft)]'
                    : 'bg-accent-600 shadow-[0_0_0_3px_var(--color-accent-50)]',
                )}
              />
            </span>
          )}
        </div>

        {/* 아래 칸 — 이름 · 어느 공연에서 얻었는지 · 가격 */}
        <div className="border-line/70 border-t px-3 py-2.5">
          <p className="line-clamp-2 text-[0.9375rem] leading-snug font-semibold">{designName}</p>
          <p className="text-subtle mt-1 truncate text-[0.8125rem]">{performanceTitle}</p>

          {price !== null && price !== undefined ? (
            <p className="mt-1.5 text-[1.0625rem] leading-none font-extrabold tabular-nums">
              {price.toLocaleString()}
              <span className="text-ink-muted ml-1 text-xs font-semibold">캣머니</span>
            </p>
          ) : (
            caption && <p className="text-subtle mt-1.5 text-[0.8125rem]">{caption}</p>
          )}
        </div>
      </div>
    </motion.button>
  );
}
