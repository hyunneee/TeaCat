import { motion } from 'motion/react';
import { Coins } from 'lucide-react';
import { PocaArt } from './PocaArt';
import { RarityBadge } from './RarityBadge';
import type { Nft } from '../model/nft.types';

interface Props {
  nft: Nft;
  onClick: () => void;
  /** 내 컬렉션에서는 소유자 대신 판매 상태를 보여줍니다 */
  showOwner?: boolean;
}

export function NftCard({ nft, onClick, showOwner = true }: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="w-full text-left"
    >
      <div className="relative">
        <PocaArt
          seed={nft.artSeed}
          rarity={nft.rarity}
          imageUrl={nft.imageUrl}
          alt={`${nft.name} 포토카드`}
        />
        <span className="absolute top-2 left-2">
          <RarityBadge rarity={nft.rarity} />
        </span>
      </div>

      <div className="mt-2 space-y-1">
        <p className="truncate text-sm font-bold">{nft.name}</p>
        <p className="text-subtle truncate text-xs">{nft.concertTitle}</p>

        {/* 가격은 이 화면에서 가장 자주 비교하는 값입니다.
            이름과 같은 크기·굵기면 눈에 안 들어와서 한 단계 키우고 배경을 깝니다. */}
        {nft.listPrice !== null ? (
          <p className="surface-2 border-line text-ink flex items-center gap-1 rounded-lg border px-2 py-1 text-[0.9375rem] leading-none font-extrabold tabular-nums">
            <Coins size={14} className="text-ink-muted shrink-0" />
            {nft.listPrice.toLocaleString()}
            <span className="text-subtle text-[0.625rem] font-semibold">포도알</span>
          </p>
        ) : (
          <p className="text-subtle text-xs">{showOwner ? nft.ownerName : '판매 안 함'}</p>
        )}
      </div>
    </motion.button>
  );
}
