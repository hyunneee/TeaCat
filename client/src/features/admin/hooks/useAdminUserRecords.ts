import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import type { CursorPage } from '@/shared/types';
import { adminUserRecordKeys, adminUserRecordsApi } from '../api/adminUserRecordsApi';

/**
 * 회원 상세의 기록 조회.
 *
 * 목록 셋(보유 포카·구매·판매)은 <b>커서 페이지</b>라 모양이 같아서 한 틀로 묶었습니다.
 * 예매만 페이지가 없는 단순 배열입니다 — 서버가 그렇게 줍니다.
 *
 * 🔴 <b>스크롤로 자동 불러오지 않습니다.</b> 어드민 표는 아래에 합계·다음 표가 이어지는데,
 *    스크롤 끝에서 자동으로 더 불러오면 그 아래에 닿을 수가 없습니다. "더 보기" 버튼이
 *    몇 장을 봤는지도 분명합니다.
 */

/** 한 번에 받아올 개수. 어드민은 화면이 넓어 앱(20)보다 넉넉하게 봅니다 */
const PAGE_SIZE = 30;

/** 예매 목록 — 페이지가 없습니다 */
export function useAdminUserTickets(userId: number) {
  return useQuery({
    queryKey: adminUserRecordKeys.tickets(userId),
    queryFn: () => adminUserRecordsApi.tickets(userId),
  });
}

/**
 * 커서 목록 공통 틀.
 *
 * `getNextPageParam` 이 `hasNext` 를 보지 않고 `nextCursor` 만 보면, 마지막 페이지에서도
 * 커서가 남아 있는 응답에 끝없이 요청을 보냅니다. 둘 다 확인합니다.
 */
function useRecordPages<T>(
  key: readonly unknown[],
  fetchPage: (cursor: string | undefined) => Promise<CursorPage<T>>,
) {
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasNext ? (last.nextCursor ?? undefined) : undefined),
  });

  return {
    ...query,
    /* 페이지를 이어붙여 화면에는 한 줄짜리 목록으로 보여줍니다 */
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
  };
}

export function useAdminUserPhotocards(userId: number) {
  return useRecordPages(adminUserRecordKeys.photocards(userId), (cursor) =>
    adminUserRecordsApi.photocards(userId, { cursor, size: PAGE_SIZE }),
  );
}

export function useAdminUserPhotocardPacks(userId: number) {
  return useQuery({
    queryKey: adminUserRecordKeys.photocardPacks(userId),
    queryFn: () => adminUserRecordsApi.photocardPacks(userId),
    enabled: Number.isInteger(userId) && userId > 0,
  });
}

export function useInvalidateAdminPhotocardPack(userId: number) {
  return useMutation({
    mutationFn: ({ packId, reason }: { packId: number; reason: string }) =>
      adminUserRecordsApi.invalidatePhotocardPack(userId, packId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminUserRecordKeys.photocardPacks(userId) });
      toast.success('카드팩을 무효화했어요.');
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '카드팩을 무효화하지 못했어요.'),
  });
}

export function useAdminUserPurchases(userId: number) {
  return useRecordPages(adminUserRecordKeys.purchases(userId), (cursor) =>
    adminUserRecordsApi.purchases(userId, { cursor, size: PAGE_SIZE }),
  );
}

export function useAdminUserSales(userId: number) {
  return useRecordPages(adminUserRecordKeys.sales(userId), (cursor) =>
    adminUserRecordsApi.sales(userId, { cursor, size: PAGE_SIZE }),
  );
}
