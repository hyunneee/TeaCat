import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import type { CursorPage } from '@/shared/types';
import { toast } from '@/shared/stores';
import { useIsLoggedIn } from '@/features/auth';
import { tokenKeys } from '@/features/token';
import { nftApi, nftKeys } from '../api/nftApi';
import { DEFAULT_SORT, mergeTrades, type NftSort } from '../model/nft.model';
import { buildPocaDex } from '../model/pocaDex.model';

const PAGE_SIZE = 20;

/**
 * 발행이 끝나기를 기다리는 동안 다시 물어보는 간격.
 *
 * 뽑은 직후 카드는 `PENDING` 이고 블록이 확정되면(약 10초) `MINTED` 가 됩니다.
 * 🔴 이걸 안 걸면 "발행 처리 중" 이 **영영 그대로** 남습니다 — 사용자는 뭔가
 * 잘못된 줄 압니다. 확정되면 스스로 멈춥니다(끝없이 폴링하지 않습니다).
 */
const MINT_POLL_MS = 3000;

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

/**
 * 등록된 카드 그림 전체.
 *
 * 누구에게나 같은 목록이고 좀처럼 바뀌지 않아 오래 들고 있습니다.
 * 🔴 **소유 정보가 아닙니다** — 내 카드 목록은 `useMyPhotocards` 입니다.
 */
export function usePhotocardArts() {
  return useQuery({
    queryKey: nftKeys.arts(),
    queryFn: nftApi.arts,
    staleTime: STALE_TIME.LONG,
    /* 🔴 재시도하지 않습니다. 이 목록을 쓰는 곳(캣머니 게임)은 **기다리는 화면**이라,
       실패했을 때 기본값대로 두 번 더 물어보면 그동안 시작 버튼이 돌기만 합니다.
       그림은 없어도 게임이 되므로(시드 SVG) 한 번 실패하면 바로 그쪽으로 갑니다. */
    retry: false,
  });
}

/**
 * 도감 — 전체 도안 위에 내가 가진 것을 얹습니다.
 *
 * 🔴 **내 카드를 끝까지 받습니다.** 목록이 커서 페이지(20장)라, 첫 페이지만 보고 세면
 * 21번째부터 가진 카드가 도감에서 "아직 없음" 으로 보입니다. 다 받을 때까지는
 * `isPending` 을 유지해서 **모자란 장수를 잠깐이라도 보여주지 않습니다** —
 * 도감에서 "×2 였는데 ×1 이 됐다" 는 버그로 읽힙니다.
 */
export function usePocaDex() {
  const pool = useQuery({
    queryKey: nftKeys.drawPool(),
    queryFn: nftApi.drawPool,
    staleTime: STALE_TIME.LONG,
  });
  const mine = useMyPhotocards();

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = mine;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const entries = useMemo(
    () => buildPocaDex(pool.data ?? [], mine.data ?? []),
    [pool.data, mine.data],
  );

  return {
    entries,
    isPending: pool.isPending || mine.isPending || !!hasNextPage,
    isError: pool.isError,
  };
}

export function usePhotocardDetail(photocardId: number) {
  return useQuery({
    queryKey: nftKeys.detail(photocardId),
    queryFn: () => nftApi.detail(photocardId),
    staleTime: STALE_TIME.SHORT,
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? MINT_POLL_MS : false),
    // URL 파라미터가 숫자가 아니면(`/nft/abc`) 부르지 않습니다. 화면은 에러 상태를 그립니다.
    enabled: Number.isInteger(photocardId) && photocardId > 0,
  });
}

/**
 * 이벤트 카드팩 받기 — **수령 화면에 들어오면 한 번** 청구합니다.
 *
 * 🔴 `granted: false` 는 실패가 아닙니다(이미 받았거나 진행 중인 이벤트가 없음).
 * 조건 판정은 전부 서버가 합니다 — 화면은 부르고 결과를 그리기만 합니다.
 */
export function useClaimEventPack() {
  const claim = useMutation({
    mutationFn: nftApi.claimPack,
    /* 팩을 두 번 청구할 이유가 없습니다 — 실패는 화면이 다시 시도하게 둡니다 */
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: nftKeys.drawAvailability() }),
  });

  /* StrictMode 는 effect 를 두 번 돌립니다. 청구가 두 번 나가지 않게 막습니다 */
  const asked = useRef(false);
  const { mutate } = claim;
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    mutate();
  }, [mutate]);

  return claim;
}

/**
 * 가진 카드팩 — 목록에 카드팩을 보여줄지, 몇 개인지 정할 때 씁니다.
 * 팩이 어떻게 늘어나는지는 서버가 정합니다. 화면은 남은 수만 봅니다.
 */
export function useDrawAvailability() {
  // 개인 데이터입니다 (useMyPhotocards 와 같은 이유로 막아둡니다).
  // 쓰는 화면은 로그인 뒤에만 열리지만, 세션 중에 토큰이 만료되면 비로그인 상태로 호출됩니다.
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: nftKeys.drawAvailability(),
    queryFn: nftApi.drawAvailability,
    /* 뽑고 나면 mutation 이 nftKeys.all 을 무효화해 곧바로 다시 물어봅니다 */
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn,
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
    /* 방금 뽑은 카드가 확정될 때까지만. 목록에 PENDING 이 하나도 없으면 멈춥니다 */
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) => page.items.some((c) => c.status === 'PENDING'))
        ? MINT_POLL_MS
        : false,
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
      /** 선택입니다. 지금 화면에는 입력칸이 없어 안 보냅니다(2차 배포 때 다시 붙습니다) */
      description?: string;
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
