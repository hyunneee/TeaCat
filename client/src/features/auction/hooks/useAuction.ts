import { useInfiniteQuery } from '@tanstack/react-query';
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
