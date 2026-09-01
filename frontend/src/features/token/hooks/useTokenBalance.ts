import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { useIsLoggedIn } from '@/features/auth';
import { tokenApi, tokenKeys } from '../api/tokenApi';

/**
 * 내 포도알 잔액.
 *
 * 잔액은 **서버 데이터**라 여기(TanStack Query)에만 있습니다.
 * 스토어에 복사하지 마세요 — 구매·결제 후 두 벌이 어긋납니다. (CLAUDE.md 3-4)
 *
 * 개인 데이터라 로그인 상태에서만 조회합니다. 비로그인 상태에서 부르면
 * 401 → 세션만료 처리로 로그인 화면에 튕깁니다.
 */
export function useTokenBalance() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: tokenKeys.balance(),
    queryFn: tokenApi.balance,
    staleTime: STALE_TIME.SHORT,
    enabled: isLoggedIn,
  });
}
