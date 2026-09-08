import { motion } from 'motion/react';
import { Gavel, Zap } from 'lucide-react';
import { PocaArt, pocaSeed } from '@/features/nft';
import { AuctionCountdown } from './AuctionCountdown';

interface Props {
  photocardId: number;
  designName: string;
  imageUrl: string | null;
  performanceTitle: string;
  currentPrice: number;
  bidCount: number;
  endsAt: string;
  /** 있으면 즉시구매 뱃지를 답니다 */
  buyNowPrice?: number | null;
  onClick: () => void;
}

/**
 * 경매 카드 한 장.
 *
 * 포카 카드(`NftCard`)와 **같은 틀**입니다 — 회색 면 위에 카드, 그 아래 글자.
 * 다른 건 세 번째 줄뿐입니다. 고정가는 값 하나로 끝나지만 경매는
 * "얼마까지 올랐고, 몇 명이 붙었고, 언제 끝나는지" 가 함께 읽혀야 결정이 됩니다.
 *
 * 그림은 포카 feature 것을 빌려 씁니다 — 같은 카드를 두 벌 그릴 이유가 없습니다.
 */
export function AuctionCard({
  photocardId,
  designName,
  imageUrl,
  performanceTitle,
  currentPrice,
  bidCount,
  endsAt,
  buyNowPrice,
  onClick,
}: Props) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.97 }} className="w-full text-left">
      <div className="surface-2 shadow-list relative flex items-center justify-center rounded-2xl px-6 py-5">
        <PocaArt
          seed={pocaSeed(photocardId)}
          imageUrl={imageUrl}
          alt={`${designName} 포토카드`}
          className="shadow-card"
        />

        {/* 즉시구매가 있는 경매는 "기다리지 않아도 된다" 는 정보라 카드 위에 올립니다.
            가격까지 적으면 현재가와 섞여 읽히므로 표시만 합니다. */}
        {buyNowPrice != null && (
          <span className="surface text-ink-muted absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold">
            <Zap size={11} />
            즉시구매
          </span>
        )}
      </div>

      <p className="mt-3 line-clamp-2 text-[0.9375rem] leading-snug font-semibold">{designName}</p>
      <p className="text-subtle mt-1 truncate text-[0.8125rem]">{performanceTitle}</p>

      <p className="mt-1.5 text-[1.0625rem] leading-none font-extrabold tabular-nums">
        {currentPrice.toLocaleString()}
        <span className="text-ink-muted ml-1 text-xs font-semibold">캣머니</span>
      </p>

      <p className="text-subtle mt-1.5 flex items-center gap-2 text-[0.8125rem]">
        <AuctionCountdown endsAt={endsAt} />
        <span className="inline-flex items-center gap-0.5">
          <Gavel size={13} />
          {bidCount}
        </span>
      </p>
    </motion.button>
  );
}
