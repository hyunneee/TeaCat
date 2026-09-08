import { Gavel } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import { formatBidTime } from '../model/auction.model';
import type { AuctionBid } from '../model/auction.types';

interface Props {
  bids: AuctionBid[];
  /** 지금 최고 입찰자인 닉네임 — 첫 줄을 강조할지 정합니다 */
  topBidderNickname?: string | null;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

/**
 * 입찰 이력.
 *
 * 공개 경매라 **누가 얼마를 언제 넣었는지 모두가 봅니다.** 이력이 보이지 않으면
 * 현재가가 진짜인지 확인할 방법이 없어 "바람잡이가 있는 것 아닌가" 가 됩니다.
 *
 * 최신이 위입니다. 맨 위 한 줄이 지금의 현재가고, 그 줄만 진하게 둡니다 —
 * 색을 쓰지 않고 굵기로 구분합니다.
 *
 * 목록이 길어질 수 있어 "더 보기" 를 둡니다. 여기서는 무한 스크롤을 쓰지 않습니다 —
 * 이 목록 아래에 하단 고정 버튼이 있어서, 스크롤로 계속 늘어나면 버튼에 닿을 수 없습니다.
 */
export function BidHistory({ bids, topBidderNickname, hasMore, loadingMore, onLoadMore }: Props) {
  if (bids.length === 0) {
    return (
      <p className="text-subtle flex items-center gap-1.5 py-2 text-sm">
        <Gavel size={15} />첫 입찰을 기다리고 있어요
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <ul className="divide-line divide-y">
        {bids.map((bid, index) => {
          const isTop = index === 0 && bid.bidderNickname === topBidderNickname;

          return (
            <li key={bid.bidId} className="flex items-baseline gap-2 py-2.5">
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-sm',
                  isTop ? 'font-bold' : 'text-muted',
                )}
              >
                {bid.bidderNickname}
              </span>
              <span className="text-subtle shrink-0 text-xs">{formatBidTime(bid.bidAt)}</span>
              <span
                className={cn(
                  'shrink-0 tabular-nums',
                  isTop ? 'text-[0.9375rem] font-extrabold' : 'text-sm font-semibold',
                )}
              >
                {bid.amount.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <Button variant="ghost" size="sm" fullWidth loading={loadingMore} onClick={onLoadMore}>
          이전 입찰 더 보기
        </Button>
      )}
    </div>
  );
}
