import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import type { CursorPage } from '@/shared/types';
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
