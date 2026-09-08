import { useCallback } from 'react';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import type { CursorPage } from '@/shared/types';
import { toast } from '@/shared/stores';
import { nftKeys } from '@/features/nft';
import { tokenKeys } from '@/features/token';
import { auctionApi, auctionKeys } from '../api/auctionApi';
import { DEFAULT_AUCTION_SORT, type AuctionSort } from '../model/auction.model';

const PAGE_SIZE = 20;

/** 서버 커서 페이지 → 다음 pageParam. 마지막 페이지면 undefined (더 안 부름) */
function nextCursor<T>(last: CursorPage<T>): string | undefined {
  return last.hasNext && last.nextCursor ? last.nextCursor : undefined;
}

/**
 * 진행 중 경매 목록 — 커서 페이지.
 *
 * `data` 는 페이지들을 평탄화한 배열입니다.
 * 폴링하지 않습니다 — 카드의 남은 시간은 클라이언트가 계산하고, 현재가는
 * 목록에서 몇 초 늦어도 문제가 없습니다. 정확한 값이 필요한 곳은 상세입니다.
 */
export function useAuctions(
  params: { keyword?: string; sort?: AuctionSort; performanceId?: number } = {},
) {
  const { keyword, sort = DEFAULT_AUCTION_SORT, performanceId } = params;
  const trimmed = keyword?.trim() || undefined;

  return useInfiniteQuery({
    queryKey: auctionKeys.list(trimmed, sort, performanceId),
    queryFn: ({ pageParam }) =>
      auctionApi.list({ keyword: trimmed, sort, performanceId, cursor: pageParam, size: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    staleTime: STALE_TIME.SHORT,
    select: (data) => data.pages.flatMap((page) => page.items),
  });
}

/** 진행 중인 경매를 다시 물어보는 주기. 현재가·입찰 수가 이 간격으로 갱신됩니다 */
const POLL_MS = 4000;

/**
 * 경매 상세.
 *
 * 진행 중일 때만 폴링합니다. 종료된 경매는 더 바뀔 것이 없어 멈춥니다
 * (`refetchInterval` 이 false 를 돌려주면 TanStack Query 가 타이머를 끕니다).
 * 탭이 백그라운드로 가면 기본값(`refetchIntervalInBackground: false`)이 알아서 멈춥니다.
 *
 * 🔴 이 조회는 서버에서 **만료된 경매를 닫습니다.** 카운트다운이 0 이 되면
 * 화면이 스스로 "끝났다" 고 판정하지 말고 이걸 다시 불러 서버 판정을 받으세요.
 */
export function useAuctionDetail(auctionId: number) {
  return useQuery({
    queryKey: auctionKeys.detail(auctionId),
    queryFn: () => auctionApi.detail(auctionId),
    // 현재가는 남이 언제든 올릴 수 있어 캐시를 신뢰하지 않습니다.
    staleTime: 0,
    enabled: Number.isInteger(auctionId) && auctionId > 0,
    refetchInterval: (query) => (query.state.data?.status === 'ACTIVE' ? POLL_MS : false),
  });
}

/**
 * 입찰 이력 — 최신순 커서 페이지.
 * 폴링하지 않습니다. 상세가 새 현재가를 물어올 때 이 키도 함께 무효화됩니다.
 */
export function useAuctionBids(auctionId: number) {
  return useInfiniteQuery({
    queryKey: auctionKeys.bids(auctionId),
    queryFn: ({ pageParam }) => auctionApi.bids(auctionId, { cursor: pageParam, size: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    staleTime: STALE_TIME.SHORT,
    enabled: Number.isInteger(auctionId) && auctionId > 0,
    select: (data) => data.pages.flatMap((page) => page.items),
  });
}

/**
 * 경매가 움직이면 함께 바뀌는 것들.
 *
 * 현재가·입찰 이력·목록은 물론, 낙찰·즉시구매는 **카드 주인과 캣머니 잔액**까지 바꿉니다.
 * 잔액은 별도 feature 가 들고 있으므로 그 키도 함께 무효화합니다.
 */
function invalidateAuction(auctionId: number) {
  void queryClient.invalidateQueries({ queryKey: auctionKeys.detail(auctionId) });
  void queryClient.invalidateQueries({ queryKey: auctionKeys.bids(auctionId) });
  void queryClient.invalidateQueries({ queryKey: auctionKeys.all });
  void queryClient.invalidateQueries({ queryKey: nftKeys.all });
  void queryClient.invalidateQueries({ queryKey: tokenKeys.balance() });
}

const codeOf = (error: unknown) => (ApiError.isApiError(error) ? error.code : '');
const messageOf = (error: unknown, fallback: string) =>
  ApiError.isApiError(error) ? error.message : fallback;

/**
 * 입찰.
 *
 * 서버 에러 코드마다 할 일이 다릅니다.
 *   NFT_026 이미 최고 입찰자 — **성공으로 봅니다.** 같은 요청이 두 번 갔을 때도
 *           이 코드가 오고, 그 상태는 사용자가 원한 결과와 같습니다.
 *   NFT_027 현재가가 올랐음 — 실패 응답에는 새 현재가가 없으므로 상세를 다시 읽습니다.
 *   NFT_023 · NFT_022 마감·종료 — 상세를 다시 읽습니다. **그 조회가 경매를 닫고** 결과를 줍니다.
 *   NFT_028 즉시구매가 이상 — 즉시구매를 쓰라고 알려줍니다.
 *   WALLET_005 가용 잔액 부족.
 *
 * 성공하면 `resolve`, 그 밖의 실패는 `reject` 합니다 — 폼이 열린 채로 남아
 * 금액을 다시 치지 않아도 되게 하기 위해서입니다.
 */
export function usePlaceBid(auctionId: number) {
  const mutation = useMutation({
    mutationFn: (amount: number) => auctionApi.bid(auctionId, amount),
    retry: false,
    onSuccess: (result) => {
      invalidateAuction(auctionId);
      toast.success(`${result.amount.toLocaleString()}캣머니로 입찰했어요.`);
    },
    onError: (error) => {
      const code = codeOf(error);

      if (code === 'NFT_026') {
        invalidateAuction(auctionId);
        toast.info('이미 최고 입찰자예요.');
        return;
      }
      if (code === 'NFT_027') {
        invalidateAuction(auctionId);
        toast.error('현재가가 올랐어요. 금액을 다시 확인해 주세요.');
        return;
      }
      if (code === 'NFT_023' || code === 'NFT_022') {
        invalidateAuction(auctionId);
        toast.error('경매가 종료됐어요.');
        return;
      }
      toast.error(messageOf(error, '입찰에 실패했어요.'));
    },
  });

  const { mutateAsync } = mutation;

  const placeBid = useCallback(
    async (amount: number) => {
      try {
        await mutateAsync(amount);
      } catch (error) {
        // 이미 최고 입찰자면 원하던 결과와 같으므로 폼을 닫습니다.
        if (codeOf(error) === 'NFT_026') return;
        throw error;
      }
    },
    [mutateAsync],
  );

  return { placeBid, isPending: mutation.isPending };
}

/**
 * 즉시구매.
 *
 * `Idempotency-Key` 는 **확인 모달을 열 때** 화면이 한 번 만들어 넘깁니다.
 * 여기서 만들면 재시도마다 새 키가 되어 두 번 결제될 수 있습니다.
 */
export function useBuyNow(auctionId: number) {
  return useMutation({
    mutationFn: (idempotencyKey: string) => auctionApi.buyNow(auctionId, idempotencyKey),
    retry: false,
    onSuccess: () => {
      invalidateAuction(auctionId);
      toast.success('즉시구매로 포토카드를 가져왔어요.');
    },
    onError: (error) => {
      const code = codeOf(error);
      if (code === 'NFT_023' || code === 'NFT_022') {
        invalidateAuction(auctionId);
        toast.error('경매가 종료됐어요.');
        return;
      }
      toast.error(messageOf(error, '즉시구매에 실패했어요.'));
    },
  });
}

/** 판매자 취소 — 입찰이 하나라도 있으면 서버가 거절합니다 (NFT_024) */
export function useCancelAuction(auctionId: number) {
  return useMutation({
    mutationFn: () => auctionApi.cancel(auctionId),
    retry: false,
    onSuccess: () => {
      invalidateAuction(auctionId);
      toast.info('경매를 취소했어요.');
    },
    onError: (error) => {
      invalidateAuction(auctionId);
      toast.error(messageOf(error, '취소에 실패했어요.'));
    },
  });
}
