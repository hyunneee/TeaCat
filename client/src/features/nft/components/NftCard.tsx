import { motion } from 'motion/react';
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
  onClick,
}: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="w-full text-left"
    >
      {/* 카드가 놓인 회색 면도 목록 항목입니다 — 공연·티켓과 같은 `shadow-list`.
          바탕과 면의 밝기 차가 작아서 그림자가 없으면 격자가 흐릿하게 번져 보입니다. */}
      <div className="surface-2 shadow-list flex items-center justify-center rounded-2xl px-6 py-5">
        <PocaArt
          seed={pocaSeed(photocardId)}
          imageUrl={imageUrl}
          alt={`${designName} 포토카드`}
          className="shadow-card"
        />
      </div>

      <p className="mt-3 line-clamp-2 text-[0.9375rem] leading-snug font-semibold">{designName}</p>
      <p className="text-subtle mt-1 truncate text-[0.8125rem]">{performanceTitle}</p>

      {price !== null && price !== undefined ? (
        <p className="mt-1.5 text-[1.0625rem] leading-none font-extrabold tabular-nums">
          {price.toLocaleString()}
          <span className="text-ink-muted ml-1 text-xs font-semibold">캣머니</span>
        </p>
      ) : (
        caption && <p className="text-subtle mt-1.5 text-[0.8125rem]">{caption}</p>
      )}
    </motion.button>
  );
}
