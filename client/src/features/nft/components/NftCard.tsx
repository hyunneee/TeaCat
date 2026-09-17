import { motion } from 'motion/react';
import { Badge } from '@/shared/components/ui';
import { PocaArt } from './PocaArt';
import { pocaName, pocaSeed } from '../model/nft.model';

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
  /** 내 카드의 판매 상태. 판매 중인 카드는 카드 위에 글자 라벨로 표시합니다. */
  state?: 'STORED' | 'LISTED' | 'AUCTION' | 'SETTLING';
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

          {state && state !== 'STORED' && (
            <Badge
              tone={state === 'SETTLING' ? 'quiet' : 'live'}
              size="sm"
              className="absolute top-2 right-2"
            >
              {state === 'LISTED' ? '판매 중' : state === 'AUCTION' ? '경매 중' : '정산 중'}
            </Badge>
          )}
        </div>

        {/* 아래 칸 — 이름 · 어느 공연에서 얻었는지 · 가격 */}
        <div className="border-line/70 border-t px-3 py-2.5">
          <p className="line-clamp-2 text-[0.9375rem] leading-snug font-semibold">
            {pocaName(designName)}
          </p>
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
