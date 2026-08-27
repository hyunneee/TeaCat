import { motion } from 'motion/react';
import { Coins } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { RARITY_LABEL, rarityTone } from '../model/nft.model';
import { PocaArt } from './PocaArt';
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
          <Badge tone={rarityTone(nft.rarity)}>{RARITY_LABEL[nft.rarity]}</Badge>
        </span>
      </div>

      <div className="mt-2 space-y-0.5">
        <p className="truncate text-sm font-bold">{nft.name}</p>
        <p className="text-subtle truncate text-xs">{nft.concertTitle}</p>

        {nft.listPrice !== null ? (
          <p className="text-accent-300 flex items-center gap-1 text-sm font-bold">
            <Coins size={13} />
            {nft.listPrice.toLocaleString()}
          </p>
        ) : (
          <p className="text-subtle text-xs">{showOwner ? nft.ownerName : '판매 안 함'}</p>
        )}
      </div>
    </motion.button>
  );
}
