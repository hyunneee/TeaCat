import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import type { CursorPage } from '@/shared/types';
import { toast } from '@/shared/stores';
import { useIsLoggedIn } from '@/features/auth';
import { tokenKeys } from '@/features/token';
import { nftApi, nftKeys } from '../api/nftApi';
import { DEFAULT_SORT, mergeTrades, type NftSort } from '../model/nft.model';

const PAGE_SIZE = 20;

/** 서버 커서 페이지 → 다음 pageParam. 마지막 페이지면 undefined (더 안 부름) */
function nextCursor<T>(last: CursorPage<T>): string | undefined {
  return last.hasNext && last.nextCursor ? last.nextCursor : undefined;
}

/**
 * 마켓 목록 — 커서 페이지.
 * `data` 는 페이지들을 **평탄화한 배열**입니다. 홈·검색은 첫 페이지만 쓰고,
 * 마켓은 `fetchNextPage` 를 `useInfiniteScroll` 에 꽂습니다.
 */
export function useNftMarket(
  params: { keyword?: string; sort?: NftSort; performanceId?: number } = {},
) {
  const { keyword, sort = DEFAULT_SORT, performanceId } = params;
  const trimmed = keyword?.trim() || undefined;

  return useInfiniteQuery({
    queryKey: nftKeys.market(trimmed, sort, performanceId),
    queryFn: ({ pageParam }) =>
      nftApi.market({ keyword: trimmed, sort, performanceId, cursor: pageParam, size: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    staleTime: STALE_TIME.SHORT,
    select: (data) => data.pages.flatMap((page) => page.items),
  });
}

export function usePhotocardDetail(photocardId: number) {
  return useQuery({
    queryKey: nftKeys.detail(photocardId),
    queryFn: () => nftApi.detail(photocardId),
    staleTime: STALE_TIME.SHORT,
    // URL 파라미터가 숫자가 아니면(`/nft/abc`) 부르지 않습니다. 화면은 에러 상태를 그립니다.
    enabled: Number.isInteger(photocardId) && photocardId > 0,
  });
}

export function useMyPhotocards() {
  // 개인 데이터입니다. 마켓(공개 화면)에서도 쓰기 때문에
  // 비로그인 상태에서 호출되면 401 이 나므로 반드시 막아둡니다.
  const isLoggedIn = useIsLoggedIn();

  return useInfiniteQuery({
    queryKey: nftKeys.mine(),
    queryFn: ({ pageParam }) => nftApi.mine({ cursor: pageParam, size: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn,
    select: (data) => data.pages.flatMap((page) => page.items),
  });
}

/**
 * 포카 거래 내역 — 구매·판매를 **한 목록**으로.
 *
 * 서버는 `/purchases` 와 `/sales` 를 따로 줍니다. 화면은 "이 카드를 얼마에 샀더라" 를
 * 한 줄기로 찾는 곳이라 둘을 받아 `mergeTrades` 로 섞습니다.
 * 다음 페이지는 **둘 다** 받습니다. 한쪽이 끝났으면 그쪽은 건너뜁니다.
 */
export function useMyTrades() {
  const isLoggedIn = useIsLoggedIn();

  const purchases = useInfiniteQuery({
    queryKey: nftKeys.purchases(),
    queryFn: ({ pageParam }) => nftApi.purchases({ cursor: pageParam, size: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn,
    select: (data) => data.pages.flatMap((page) => page.items),
  });

  const sales = useInfiniteQuery({
    queryKey: nftKeys.sales(),
    queryFn: ({ pageParam }) => nftApi.sales({ cursor: pageParam, size: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn,
    select: (data) => data.pages.flatMap((page) => page.items),
  });

  const trades = useMemo(
    () => mergeTrades(purchases.data ?? [], sales.data ?? []),
    [purchases.data, sales.data],
  );

  const { hasNextPage: morePurchases, fetchNextPage: fetchPurchases } = purchases;
  const { hasNextPage: moreSales, fetchNextPage: fetchSales } = sales;

  const fetchNextPage = useCallback(() => {
    if (morePurchases) void fetchPurchases();
    if (moreSales) void fetchSales();
  }, [morePurchases, fetchPurchases, moreSales, fetchSales]);

  return {
    trades,
    isPending: purchases.isPending || sales.isPending,
    hasNextPage: !!morePurchases || !!moreSales,
    isFetchingNextPage: purchases.isFetchingNextPage || sales.isFetchingNextPage,
    fetchNextPage,
  };
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

/**
 * 구매.
 * `idempotencyKey` 는 **확인 모달을 열 때** 화면이 한 번 만들어 넘깁니다.
 * 여기서 만들면 재시도마다 새 키가 되어 멱등키의 의미가 없습니다.
 */
export function usePurchasePhotocard() {
  return useMutation({
    mutationFn: ({
      photocardId,
      idempotencyKey,
    }: {
      photocardId: number;
      idempotencyKey: string;
    }) => nftApi.purchase(photocardId, idempotencyKey),
    retry: false,
    onSuccess: () => {
      invalidateTrade();
      toast.success('포토카드를 구매했어요.');
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '구매에 실패했어요.'),
  });
}

export function useListPhotocard() {
  return useMutation({
    mutationFn: ({
      photocardId,
      price,
      description,
    }: {
      photocardId: number;
      price: number;
      description: string;
    }) => nftApi.list(photocardId, { price, description }),
    onSuccess: () => {
      invalidateTrade();
      toast.success('판매 등록이 완료됐어요.');
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '등록에 실패했어요.'),
  });
}

export function useUnlistPhotocard() {
  return useMutation({
    mutationFn: (photocardId: number) => nftApi.unlist(photocardId),
    onSuccess: () => {
      invalidateTrade();
      toast.info('판매를 내렸어요.');
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '취소에 실패했어요.'),
  });
}
