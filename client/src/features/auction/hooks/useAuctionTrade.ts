import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTokenBalance } from '@/features/token';
import { nftKeys } from '@/features/nft';
import { queryClient } from '@/shared/api';
import { tokenKeys } from '@/features/token';
import {
  useAuctionDetail,
  useAuctionBids,
  usePlaceBid,
  useBuyNow,
  useCancelAuction,
} from './useAuction';

export function useAuctionTrade(auctionId: number) {
  const navigate = useNavigate();

  const location = useLocation();

  const { data: auction, isPending, isError, refetch } = useAuctionDetail(auctionId);
  const bids = useAuctionBids(auctionId, auction?.status === 'ACTIVE');
  const { data: token } = useTokenBalance();
  const { placeBid, isPending: bidding } = usePlaceBid(auctionId);
  const buyNow = useBuyNow(auctionId);
  const cancel = useCancelAuction(auctionId);
  const photocardId = auction?.photocard.photocardId;
  const status = auction?.status;
  useEffect(() => {
    if (!photocardId || !status || status === 'ACTIVE') return;
    void queryClient.invalidateQueries({ queryKey: nftKeys.all });
    void queryClient.invalidateQueries({ queryKey: tokenKeys.balance() });
  }, [photocardId, status]);

  /* 카운트다운이 0 에 닿으면 서버에 결과를 물어봅니다.
     `refetch` 는 참조가 안정적이라 카운트다운이 매초 다시 부르지 않습니다. */
  const handleEnd = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    auction,
    isPending,
    isError,
    refetch,
    bids,
    token,
    placeBid,
    bidding,
    buyNow,
    cancel,
    handleEnd,
    navigate,
    location,
  };
}
