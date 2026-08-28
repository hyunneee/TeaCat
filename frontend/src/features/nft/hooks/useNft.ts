import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { authKeys, useAuthStore } from '@/features/auth';
import { nftApi, nftKeys } from '../api/nftApi';
import type { Rarity } from '../model/nft.types';

export function useNftMarket(rarity?: Rarity, q?: string) {
  return useQuery({
    queryKey: nftKeys.market(rarity, q),
    queryFn: () => nftApi.market({ rarity, q }),
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
  const isLoggedIn = useAuthStore((s) => !!s.accessToken);

  return useQuery({
    queryKey: nftKeys.mine(),
    queryFn: () => nftApi.mine(),
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn,
  });
}

export function useTokenBalance() {
  // 개인 데이터라 로그인 상태에서만 조회합니다.
  // 비로그인 상태에서 부르면 401 -> 세션만료 처리로 로그인 화면에 튕깁니다.
  const isLoggedIn = useAuthStore((s) => !!s.accessToken);

  return useQuery({
    queryKey: nftKeys.token(),
    queryFn: () => nftApi.tokenBalance(),
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn,
  });
}

/** 거래는 잔액과 소유자가 함께 바뀌므로 auth/nft/token 캐시를 모두 무효화합니다. */
function invalidateTrade() {
  void queryClient.invalidateQueries({ queryKey: nftKeys.all });
  void queryClient.invalidateQueries({ queryKey: nftKeys.token() });
  void queryClient.invalidateQueries({ queryKey: authKeys.me() });
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
