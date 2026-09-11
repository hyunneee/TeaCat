import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { concertKeys } from '@/features/concert';
import { organizerApi, organizerKeys } from '../api/organizerApi';

/**
 * 내가 등록한 공연 목록 — 비공개 포함.
 * 클라이언트 목록(useConcerts)은 비공개를 숨기므로, 등록자는 이 목록으로 비공개 공연을 다시 찾습니다.
 */
export function useMyConcerts(enabled = true) {
  return useQuery({
    queryKey: organizerKeys.myConcerts(),
    queryFn: organizerApi.myConcerts,
    staleTime: STALE_TIME.SHORT,
    enabled,
  });
}

/**
 * 내가 등록한 공연 상세 — 비공개여도 옵니다.
 * 수정 화면은 클라이언트 상세(useConcertDetail) 대신 이걸 씁니다. 그쪽은 비공개 공연이 404 라 수정할 수 없기 때문입니다.
 */
export function useMyConcert(concertId: string) {
  return useQuery({
    queryKey: organizerKeys.myConcert(concertId),
    queryFn: () => organizerApi.myConcert(concertId),
    staleTime: STALE_TIME.SHORT,
    enabled: !!concertId,
  });
}

/**
 * 공연 공개·비공개 전환. 되돌릴 수 있는 동작이라 확인 모달은 호출부 판단에 맡깁니다.
 * 바뀌면 클라이언트 목록·상세와 내 공연 목록·상세 캐시를 모두 비웁니다 — 양쪽 다 이 값에 따라 달라집니다.
 */
export function useSetVisibility(concertId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (visible: boolean) => organizerApi.setVisibility(concertId, visible),
    retry: false,
    onSuccess: ({ visible }) => {
      void queryClient.invalidateQueries({ queryKey: concertKeys.all });
      void queryClient.invalidateQueries({ queryKey: organizerKeys.all });
      toast.success(visible ? '공연을 공개했어요.' : '공연을 비공개로 바꿨어요. 목록과 상세에서 보이지 않아요.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '노출 상태를 바꾸지 못했어요.');
    },
  });
}
