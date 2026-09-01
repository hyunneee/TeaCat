import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { useIsLoggedIn } from '@/features/auth';
import { tokenKeys } from '@/features/token';
import { nftApi, nftKeys } from '../api/nftApi';
import type { NftSort } from '../model/nft.model';

export function useNftMarket(q?: string, sort?: NftSort) {
  return useQuery({
    queryKey: nftKeys.market(q, sort),
    queryFn: () => nftApi.market({ q, sort }),
    staleTime: STALE_TIME.SHORT,
    select: (page) => page.items,
  });
}

export function useNftDetail(nftId: string) {
  return useQuery({
    queryKey: nftKeys.detail(nftId),
    queryFn: () => nftApi.detail(nftId),
    staleTime: STALE_TIME.SHORT,
    enabled: !!nftId,
  });
}

export function useMyNfts() {
  // 개인 데이터입니다. 마켓(공개 화면)에서도 개수를 쓰기 때문에
  // 비로그인 상태에서 호출되면 401 이 나므로 반드시 막아둡니다.
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: nftKeys.mine(),
    queryFn: () => nftApi.mine(),
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn,
  });
}

/**
 * 포카 거래 내역.
 *
 * 개인 데이터라 로그인 상태에서만 조회합니다.
 */
export function useNftTrades() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: nftKeys.trades(),
    queryFn: () => nftApi.trades(),
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn,
  });
}

/**
 * 거래가 끝나면 **카드 소유자와 캣머니 잔액**이 함께 바뀝니다.
 * 잔액은 별도 feature(`@/features/token`)가 들고 있으므로 그 키도 함께 무효화합니다.
 * (내 정보는 거래로 바뀌지 않으므로 건드리지 않습니다)
 */
function invalidateTrade() {
  void queryClient.invalidateQueries({ queryKey: nftKeys.all });
  void queryClient.invalidateQueries({ queryKey: tokenKeys.balance() });
}

export function usePurchaseNft() {
  return useMutation({
    mutationFn: (nftId: string) => nftApi.purchase(nftId),
    onSuccess: (nft) => {
      invalidateTrade();
      toast.success(`'${nft.name}' 포토카드를 구매했어요.`);
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '구매에 실패했어요.'),
  });
}

export function useListNft() {
  return useMutation({
    mutationFn: ({ nftId, price, description }: { nftId: string; price: number; description?: string }) =>
      nftApi.list(nftId, { price, description }),
    onSuccess: () => {
      invalidateTrade();
      toast.success('판매 등록이 완료됐어요.');
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '등록에 실패했어요.'),
  });
}

export function useUnlistNft() {
  return useMutation({
    mutationFn: (nftId: string) => nftApi.unlist(nftId),
    onSuccess: () => {
      invalidateTrade();
      toast.info('판매를 내렸어요.');
    },
  });
}
