import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { getViewSessionId, parseServerTime } from '@/shared/lib';
import type { CursorPage } from '@/shared/types';
import { toast } from '@/shared/stores';
import { useAuth, useIsLoggedIn } from '@/features/auth';
import { tokenKeys } from '@/features/token';
import { nftApi, nftKeys } from '../api/nftApi';
import { DEFAULT_SORT, mergeTrades, nextLockedOpenAt, type NftSort } from '../model/nft.model';
import type { PhotocardDetail } from '../model/nft.types';
import { buildPocaDex } from '../model/pocaDex.model';

const PAGE_SIZE = 20;

export function useNftMarketPage(
  params: { keyword?: string; sort: NftSort; cursor?: string },
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...nftKeys.market(params.keyword, params.sort), 'page', params.cursor, 25],
    queryFn: () => nftApi.market({ ...params, size: 25 }),
    enabled,
    staleTime: STALE_TIME.SHORT,
  });
}

/**
 * 발행이 끝나기를 기다리는 동안 다시 물어보는 간격.
 *
 * 뽑은 직후 카드는 `PENDING` 이고 블록이 확정되면(약 10초) `MINTED` 가 됩니다.
 * 🔴 이걸 안 걸면 "발행 처리 중" 이 **영영 그대로** 남습니다 — 사용자는 뭔가
 * 잘못된 줄 압니다. 확정되면 스스로 멈춥니다(끝없이 폴링하지 않습니다).
 */
const MINT_POLL_MS = 3000;

/** `setTimeout` 이 견디는 최대 지연(2^31-1 ms ≈ 24.8일). 넘기면 즉시 실행됩니다 */
const MAX_TIMER_MS = 2 ** 31 - 1;

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
 * 내 포카 요약 — 도안별 보유 수·판매 상태.
 *
 * 카드 목록(`useMyPhotocards`)과 달리 **한 번의 요청**입니다. 도감이 필요한 것은 개수뿐이라
 * 카드를 페이지마다 끝까지 받아 오던 것을 이걸로 대신합니다.
 *
 * 🔴 `pendingCount > 0` 일 때만 다시 물어봅니다 — 발행 중이거나 정산 중인 카드가 있어서 상태가
 * 바뀔 것이 있을 때입니다. 0 이면 스스로 멈춥니다. 예전에는 카드 목록 전체를 3초마다 다시
 * 받았습니다(이미 받은 페이지를 전부 다시).
 */
export function useMyPhotocardSummary() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: nftKeys.mySummary(),
    queryFn: nftApi.mySummary,
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn,
    refetchInterval: (query) => ((query.state.data?.pendingCount ?? 0) > 0 ? MINT_POLL_MS : false),
  });
}

/**
 * 도감 — 공개된 수집 도안과 내 보유 상태를 서버가 한 번에 합쳐 줍니다.
 *
 * 🔴 미보유 카드의 이름·그림 URL은 응답부터 null입니다. "보유 카드만"을 눌렀을 때 필요한
 * 카드 한 장 한 장은 `useOwnedCards`가 그때 받습니다.
 */
export function usePocaDex() {
  const { user, isLoggedIn } = useAuth();
  const dex = useQuery({
    queryKey: [...nftKeys.all, 'template-dex', user?.userId],
    queryFn: nftApi.templateDex,
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn && !!user?.userId,
    refetchInterval: (query) => ((query.state.data?.pendingCount ?? 0) > 0 ? MINT_POLL_MS : false),
  });

  const entries = useMemo(() => buildPocaDex(dex.data?.cards ?? []), [dex.data]);

  return {
    entries,
    isPending: dex.isPending,
    isError: dex.isError,
  };
}

/**
 * 내 카드 한 장 한 장 — **"보유 카드만" 을 켰을 때만** 받습니다.
 *
 * 목록이 커서 페이지(20장)라 끝까지 받아야 21번째부터 가진 카드가 빠지지 않습니다. 다 받을
 * 때까지 `cardsPending` 을 유지해서 모자란 장수를 잠깐이라도 보여주지 않습니다.
 *
 * `enabled` 가 false 면 **아무 요청도 나가지 않습니다** — 도감만 보는 사람은 이 목록이 필요 없습니다.
 */
export function useOwnedCards(enabled: boolean) {
  const mine = useMyPhotocards(enabled);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = mine;
  useEffect(() => {
    if (enabled && hasNextPage && !isFetchingNextPage && !mine.isError) void fetchNextPage();
  }, [enabled, hasNextPage, isFetchingNextPage, fetchNextPage, mine.isError]);

  return {
    cards: mine.data ?? [],
    cardsPending: enabled && !mine.isError && (mine.isPending || !!hasNextPage),
    cardsError: enabled && mine.isError,
  };
}

/**
 * 내가 가진 **같은 도안** 카드 전부.
 *
 * 상세는 `photocardId` 로 열리는데, 도감은 같은 도안을 한 칸으로 묶어 `×3` 으로
 * 보여줍니다. 그래서 상세가 "그 셋이 각각 어디서 온 것인가" 와 "어느 장을 팔 것인가" 를
 * 이 훅에 묻습니다.
 *
 * 🔴 `designId` 는 상세 응답에서 옵니다. 상세가 오기 전에는 **부르지 않습니다** —
 * `undefined` 로 부르면 `/by-design/undefined` 가 나갑니다.
 *
 * 무효화는 `invalidateTrade` 가 `nftKeys.all` 로 한 번에 걷습니다(키가 그 아래입니다) —
 * 판매를 걸거나 내리면 이 목록의 판매 상태도 함께 갱신돼야 합니다.
 */
export function useMyDesignCopies(designId: number | undefined, templateId?: number | null) {
  const { user, isLoggedIn } = useAuth();
  return useQuery({
    queryKey: [...nftKeys.myCopies(designId ?? 0), templateId ?? null, isLoggedIn ? user?.userId : null],
    queryFn: () => templateId ? nftApi.myTemplateCopies(templateId) : nftApi.myCopies(designId as number),
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn && !!user?.userId && Number.isInteger(designId) && (designId ?? 0) > 0,
  });
}

export function usePhotocardDetail(photocardId: number) {
  const { user, isLoggedIn } = useAuth();
  return useQuery({
    queryKey: [...nftKeys.detail(photocardId), isLoggedIn ? user?.userId : null],
    queryFn: () => nftApi.detail(photocardId),
    staleTime: STALE_TIME.SHORT,
    refetchInterval: (query) => {
      const card = query.state.data;
      if (card?.status === 'PENDING') return MINT_POLL_MS;
      if (card?.listing?.status === 'SETTLING' || card?.auction?.status === 'SETTLING') {
        return MINT_POLL_MS;
      }
      return false;
    },
    // URL 파라미터가 숫자가 아니면(`/nft/abc`) 부르지 않습니다. 화면은 에러 상태를 그립니다.
    enabled: Number.isInteger(photocardId) && photocardId > 0,
  });
}

export function useRecordPhotocardView(photocardId: number, enabled: boolean) {
  const recordedId = useRef<number | null>(null);
  const record = useMutation({
    mutationFn: (id: number) => nftApi.recordView(id, getViewSessionId()),
    onSuccess: (result, id) => {
      queryClient.setQueriesData<PhotocardDetail>({ queryKey: nftKeys.detail(id) }, (current) =>
        current ? { ...current, viewCount: result.viewCount } : current,
      );
    },
  });
  const { mutate } = record;

  useEffect(() => {
    if (!enabled || !Number.isInteger(photocardId) || photocardId <= 0) return;
    if (recordedId.current === photocardId) return;
    recordedId.current = photocardId;
    mutate(photocardId);
  }, [enabled, mutate, photocardId]);

  return record;
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
 *
 * 🔴 **열리는 시각에 한 번** 다시 물어봅니다. 서버가 팩마다 개봉 시각(`packs[].openAt`)을 주므로
 * 가장 이른 잠긴 팩의 시각까지 기다렸다가 그때 한 번만 요청합니다. 예전에는 남은 시간을 60초로
 * 잘라 계속 물어봤는데, 열리기 전에는 매번 같은 답이었습니다.
 *
 * 🔴 **탭에 돌아왔을 때도 다시 받습니다**(`refetchOnWindowFocus`). 백그라운드에서는 타이머가 늦게
 * 돌 수 있고, 앱 전체가 포커스 재조회를 끄고 있어서 이 쿼리만 켭니다 — 응답이 작고 개인 값입니다.
 */
export function useDrawAvailability() {
  // 개인 데이터입니다 (useMyPhotocards 와 같은 이유로 막아둡니다).
  // 쓰는 화면은 로그인 뒤에만 열리지만, 세션 중에 토큰이 만료되면 비로그인 상태로 호출됩니다.
  const isLoggedIn = useIsLoggedIn();

  const query = useQuery({
    queryKey: nftKeys.drawAvailability(),
    queryFn: nftApi.drawAvailability,
    /* 뽑고 나면 mutation 이 nftKeys.all 을 무효화해 곧바로 다시 물어봅니다 */
    staleTime: STALE_TIME.SHORT,
    refetchOnWindowFocus: true,
    enabled: isLoggedIn,
  });

  const { refetch, dataUpdatedAt } = query;
  const nextOpenAt = nextLockedOpenAt(query.data);
  useEffect(() => {
    if (!nextOpenAt) return;

    const delay = parseServerTime(nextOpenAt) - Date.now();
    if (!Number.isFinite(delay)) return;
    /* setTimeout 은 약 24.8일(2^31ms)을 넘으면 즉시 실행돼 버립니다 — 그보다 먼 팩은 기다리지 않습니다.
       화면을 그만큼 오래 열어 두는 일은 없고, 다시 들어오면 새로 받습니다. */
    if (delay > MAX_TIMER_MS) return;

    /* 여유 250ms: 서버 시계보다 조금 늦게 물어야 "이미 열렸다" 는 답이 옵니다.
       내 시계가 서버보다 빨라 이미 지났다고 나오면(delay ≤ 0) 5초 뒤에 다시 봅니다 —
       재요청이 `dataUpdatedAt` 을 바꿔 이 effect 가 다시 돌므로, 서버가 열렸다고 답할 때까지만 반복됩니다. */
    const timer = setTimeout(() => void refetch(), delay > 0 ? delay + 250 : 5000);
    return () => clearTimeout(timer);
  }, [nextOpenAt, dataUpdatedAt, refetch]);

  return query;
}

export function useMyPhotocards(enabled = true) {
  // 개인 데이터입니다. 마켓(공개 화면)에서도 쓰기 때문에
  // 비로그인 상태에서 호출되면 401 이 나므로 반드시 막아둡니다.
  const isLoggedIn = useIsLoggedIn();

  return useInfiniteQuery({
    queryKey: nftKeys.mine(),
    queryFn: ({ pageParam }) => nftApi.mine({ cursor: pageParam, size: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn && enabled,
    /* 민팅 또는 거래 정산이 끝날 때까지만 갱신합니다. 완료되면 스스로 멈춥니다. */
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.items.some((c) => c.status === 'PENDING' || c.marketStatus === 'SETTLING'),
      )
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

/** 내 판매 내역 — 마이페이지의 독립 메뉴에서 판매 건만 확인합니다. */
export function useMySales() {
  const isLoggedIn = useIsLoggedIn();

  return useInfiniteQuery({
    queryKey: nftKeys.sales(),
    queryFn: ({ pageParam }) => nftApi.sales({ cursor: pageParam, size: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn,
    select: (data) => data.pages.flatMap((page) => page.items),
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

/**
 * 구매.
 * `idempotencyKey` 는 **확인 모달을 열 때** 화면이 한 번 만들어 넘깁니다.
 * 여기서 만들면 재시도마다 새 키가 되어 멱등키의 의미가 없습니다.
 */
export function usePurchasePhotocard() {
  return useMutation({
    mutationFn: async ({
      photocardId,
      idempotencyKey,
    }: {
      photocardId: number;
      idempotencyKey: string;
    }) => {
      const trade = await nftApi.purchase(photocardId, idempotencyKey);
      // 정산 시작 상태를 곧바로 보여주고, 소유권 이전 완료까지는 이어서 기다립니다.
      invalidateTrade();
      return nftApi.waitForTrade(trade);
    },
    retry: false,
    onSuccess: (trade) => {
      invalidateTrade();
      if (trade.status !== 'COMPLETED') {
        toast.error(
          trade.status === 'COMPENSATED'
            ? '포토카드 이전에 실패해 결제 금액을 돌려드렸어요.'
            : '거래 확인이 지연되고 있어요. 잠시 후 거래 내역을 확인해 주세요.',
        );
        return;
      }
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
      /** 판매 카드 상태와 거래 조건을 설명하는 선택 입력입니다. */
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
