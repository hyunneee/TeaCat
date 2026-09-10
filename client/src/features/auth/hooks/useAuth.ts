import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { setSentryUser } from '@/shared/lib';
import { authApi, authKeys } from '../api/authApi';
import { useAuthStore } from '../store/authStore';

/**
 * 로그인 여부만 필요할 때. (쿼리를 돌리지 않습니다)
 *
 * "내 데이터니까 로그인했을 때만 조회" 하는 훅들이 `enabled` 에 쓰라고 만든 것입니다.
 * 이걸 안 쓰고 스토어를 직접 들여다보면 인증 내부 구조가 다른 feature 로 새어 나갑니다.
 */
export function useIsLoggedIn(): boolean {
  return useAuthStore((s) => !!s.accessToken);
}

/**
 * Controller 레이어.
 * 화면은 "지금 로그인한 사람이 누구고 무엇을 할 수 있는가"만 물어보면 됩니다.
 * 토큰이 어디 저장되는지, 어떤 API 를 때리는지는 몰라도 됩니다.
 *
 * ── 내 정보의 원본은 **한 곳** 입니다 ──────────────────────
 * 서버가 준 값(TanStack Query 캐시)이 원본이고, 스토어의 `userSnapshot` 은
 * 새로고침 직후 한 프레임을 채우기 위한 **사본**입니다.
 * 그래서 이 훅이 쿼리 → 스냅샷 **한 방향으로만** 베껴 씁니다.
 *
 * 내 정보를 바꾸는 쪽(얼굴 등록 등)은 **쿼리 캐시만** 갱신하세요.
 * 양쪽을 각각 고치면 두 벌이 어긋나 "등록했는데 미등록으로 보이는" 사고가 납니다.
 */
export function useAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const snapshot = useAuthStore((s) => s.userSnapshot);
  const syncUserSnapshot = useAuthStore((s) => s.syncUserSnapshot);

  const { data, isPending } = useQuery({
    queryKey: authKeys.me(),
    queryFn: authApi.me,
    enabled: !!accessToken, // 로그인 상태에서만 조회
    staleTime: STALE_TIME.SHORT,
  });

  useEffect(() => {
    if (data) syncUserSnapshot(data);
  }, [data, syncUserSnapshot]);

  /* 에러가 났을 때 "누구에게 났는지" 를 붙입니다.
     🔴 userId 만 보냅니다 — 이메일·닉네임·전화번호는 넣지 마세요 (shared/lib/sentry.ts).
     로그아웃하면 지워서 다음 사용자의 에러에 남의 id 가 붙지 않게 합니다. */
  const userId = data?.userId ?? snapshot?.userId ?? null;
  useEffect(() => {
    setSentryUser(accessToken ? userId : null);
  }, [accessToken, userId]);

  return {
    // 서버가 준 최신 정보를 우선하되, 첫 로딩 동안은 스냅샷으로 화면을 그립니다.
    user: data ?? snapshot,
    isLoggedIn: !!accessToken,
    isLoading: !!accessToken && isPending && !snapshot,
  };
}
