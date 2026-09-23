import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { useIsLoggedIn } from '@/features/auth';
import { tokenApi, tokenKeys } from '../api/tokenApi';

/**
 * 짝 맞추기 오늘 랭킹.
 *
 * 순위표는 남이 갱신하므로 화면에 돌아올 때 다시 물어봅니다. 폴링은 하지 않습니다 —
 * 초 단위로 바뀌는 값이 아니고, 게임 중에 순위표를 계속 긁을 이유가 없습니다.
 */
export function useMemoryRanking() {
  return useQuery({
    queryKey: tokenKeys.memoryRanking(),
    queryFn: tokenApi.memoryRanking,
    staleTime: STALE_TIME.SHORT,
    enabled: useIsLoggedIn(),
    refetchOnWindowFocus: true,
  });
}

/**
 * 판을 서버에 열고 닫습니다. **시간은 서버가 잽니다.**
 *
 * 화면의 시계(`useMemoryGame`)는 사용자에게 보여주는 용도이고, 순위에 올라가는 값은 여기서
 * 돌아오는 `elapsedMs` 입니다. 둘이 조금 다를 수 있는데(네트워크 왕복), 그게 정상입니다.
 *
 * 🔴 시작 요청이 실패해도 **게임은 그대로 진행합니다.** 기록이 안 남을 뿐인데, 그 때문에
 * 판을 못 열게 하면 서버가 잠깐 흔들릴 때 게임 자체를 못 하게 됩니다.
 */
export function useMemoryGameRecord() {
  const start = useMutation({
    mutationFn: tokenApi.startMemoryGame,
  });

  const clear = useMutation({
    mutationFn: ({ sessionId, moves }: { sessionId: number; moves: number }) =>
      tokenApi.clearMemoryGame(sessionId, moves),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tokenKeys.memoryRanking() });
    },
  });

  return {
    /** 판을 연다. 실패하면 null — 호출부는 그래도 게임을 시작한다 */
    startSession: async (): Promise<number | null> => {
      try {
        const { sessionId } = await start.mutateAsync();
        return sessionId;
      } catch {
        return null;
      }
    },
    /** 클리어를 기록한다. 세션이 없으면(시작 실패) 아무것도 하지 않는다 */
    recordClear: (sessionId: number | null, moves: number) => {
      if (sessionId === null) return;
      clear.mutate({ sessionId, moves });
    },
    /** 서버가 확정한 결과. 순위에 올라간 값이다 */
    result: clear.data ?? null,
    recording: clear.isPending,
  };
}
