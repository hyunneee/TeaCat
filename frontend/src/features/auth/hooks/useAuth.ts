import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { authApi, authKeys } from '../api/authApi';
import { useAuthStore } from '../store/authStore';

/**
 * Controller 레이어.
 * 화면은 "지금 로그인한 사람이 누구고 무엇을 할 수 있는가"만 물어보면 됩니다.
 * 토큰이 어디 저장되는지, 어떤 API 를 때리는지는 몰라도 됩니다.
 */
export function useAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const cachedUser = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);

  const { data, isPending } = useQuery({
    queryKey: authKeys.me(),
    queryFn: authApi.me,
    enabled: !!accessToken, // 로그인 상태에서만 조회
    staleTime: STALE_TIME.SHORT,
  });

  // 서버가 준 최신 정보를 우선하되, 첫 로딩 동안은 저장된 값으로 화면을 그립니다.
  const user = data ?? cachedUser;

  return {
    user,
    isLoggedIn: !!accessToken,
    isLoading: !!accessToken && isPending && !cachedUser,
    patchUser,
  };
}
