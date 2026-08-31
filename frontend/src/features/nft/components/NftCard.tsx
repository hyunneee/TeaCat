import { motion } from 'motion/react';
import { PocaArt } from './PocaArt';
import type { Nft } from '../model/nft.types';

interface Props {
  nft: Nft;
  onClick: () => void;
  /** 내 컬렉션에서는 소유자 대신 판매 상태를 보여줍니다 */
  showOwner?: boolean;
}

/**
 * 마켓·컬렉션의 포카 한 장.
 *
 * ── 테두리를 두르지 않습니다 ───────────────────────────────
 * 카드가 격자로 여러 장 깔리면 테두리끼리 선이 겹쳐 화면이 지저분해집니다.
 * **연회색 면**만 깔고, 그 위에 카드를 여백을 두고 올립니다.
 * 면과 면 사이의 흰 여백이 곧 구분선 역할을 합니다.
 *
 * 글자는 셋뿐입니다 — 이름 · 공연 · 가격. 가격이 가장 큽니다.
 */
export function NftCard({ nft, onClick, showOwner = true }: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="w-full text-left"
    >
      <div className="surface-2 flex items-center justify-center rounded-2xl px-6 py-5">
        <PocaArt
          seed={nft.artSeed}
          imageUrl={nft.imageUrl}
          alt={`${nft.name} 포토카드`}
          className="shadow-card"
        />
      </div>

      <p className="mt-3 line-clamp-2 text-[0.9375rem] leading-snug font-semibold">{nft.name}</p>
      <p className="text-subtle mt-1 truncate text-[0.8125rem]">{nft.concertTitle}</p>

      {nft.listPrice !== null ? (
        <p className="mt-1.5 text-[1.0625rem] leading-none font-extrabold tabular-nums">
          {nft.listPrice.toLocaleString()}
          <span className="text-ink-muted ml-1 text-xs font-semibold">포도알</span>
        </p>
      ) : (
        <p className="text-subtle mt-1.5 text-[0.8125rem]">
          {showOwner ? nft.ownerName : '보관 중'}
        </p>
      )}
    </motion.button>
  );
}
