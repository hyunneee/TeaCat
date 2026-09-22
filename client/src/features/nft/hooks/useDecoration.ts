import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { decorationApi, decorationKeys } from '../api/decorationApi';
import { nftKeys } from '../api/nftApi';
import { DECORATION_ERROR, type Decoration } from '../model/decoration.types';

/**
 * 저장·삭제 뒤에 **반드시** 털어야 하는 캐시들.
 *
 * 🔴 빠뜨리면 돌아갔을 때 예전 그림이 남아 **"저장이 안 된 것처럼" 보입니다.**
 * 꾸민 그림은 세 곳에 실려 옵니다 — 꾸밈 자체(다시 꾸미기), 내 카드 목록, 카드 상세.
 */
function invalidateDecorated(photocardId: number) {
  queryClient.invalidateQueries({ queryKey: decorationKeys.detail(photocardId) });
  queryClient.invalidateQueries({ queryKey: nftKeys.mine() });
  /* 상세 쿼리 키는 뒤에 userId 가 한 칸 더 붙습니다 — 접두사로 맞춥니다 */
  queryClient.invalidateQueries({ queryKey: nftKeys.detail(photocardId) });
}

/**
 * 이 카드의 꾸밈 — 다시 꾸밀 때 배치를 복원하려고 받습니다.
 *
 * 🔴 **꾸민 적이 없으면 404(`NFT_065`) 가 정상**입니다. 그것만 `null` 로 바꿔 돌려주고
 *    나머지 실패는 그대로 에러로 둡니다. 화면은 `data === null` 을 "아직 안 꾸밈" 으로 읽습니다.
 *    (`isError` 로 다루면 "불러오지 못했어요" 가 처음 꾸미는 사람에게 뜹니다)
 */
export function useDecoration(photocardId: number, enabled = true) {
  return useQuery<Decoration | null>({
    queryKey: decorationKeys.detail(photocardId),
    queryFn: async () => {
      try {
        return await decorationApi.get(photocardId);
      } catch (e) {
        if (ApiError.isApiError(e) && e.code === DECORATION_ERROR.NOT_FOUND) return null;
        throw e;
      }
    },
    enabled: enabled && Number.isInteger(photocardId) && photocardId > 0,
    /* presigned 주소라 오래 들고 있어 봐야 만료됩니다 */
    staleTime: STALE_TIME.SHORT,
    retry: false,
  });
}

/**
 * 꾸민 카드 저장(덮어쓰기).
 *
 * 🔴 **실패해도 화면의 배치를 건드리지 않습니다.** 20장 얹어 놓고 통신이 끊겼는데
 *    초기화되면 처음부터 다시 해야 합니다 — 여기서는 알리기만 하고, 되돌리는 일은 하지 않습니다.
 */
export function useSaveDecoration(photocardId: number) {
  return useMutation({
    mutationFn: (body: { imageBase64: string; placements: string }) =>
      decorationApi.save(photocardId, body),
    /* 재시도하지 않습니다 — 수 MB 짜리 PNG 를 조용히 두 번 올리지 않습니다 */
    retry: false,
    onSuccess: () => {
      invalidateDecorated(photocardId);
      toast.success('꾸민 카드를 저장했어요');
    },
    onError: (e) => {
      if (ApiError.isApiError(e) && e.code === DECORATION_ERROR.IMAGE_TOO_LARGE) {
        toast.error('그림이 너무 커요. 스티커를 줄이거나 몇 개 빼고 다시 저장해 주세요');
        return;
      }
      toast.error('저장하지 못했어요. 잠시 후 다시 시도해 주세요');
    },
  });
}

/** 꾸밈 지우기 — 되돌릴 수 없는 동작이라 화면이 확인 모달을 먼저 띄웁니다 (CLAUDE.md 4-7) */
export function useDeleteDecoration(photocardId: number) {
  return useMutation({
    mutationFn: () => decorationApi.remove(photocardId),
    onSuccess: () => {
      invalidateDecorated(photocardId);
      toast.success('꾸밈을 지웠어요');
    },
    onError: () => toast.error('지우지 못했어요. 잠시 후 다시 시도해 주세요'),
  });
}
