import { useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { ROUTES, STALE_TIME } from '@/shared/constants';
import { authApi, authKeys } from '../api/authApi';
import { useAuthStore } from '../store/authStore';
import type { OauthSignupRequest } from '../model/auth.types';

/** 서버 에러 코드별 안내. 없는 코드는 기본 문구로 갑니다 */
const ERROR_MESSAGE: Record<string, string> = {
  AUTH_008: 'SSAFY 로그인은 아직 준비 중이에요.',
  AUTH_009: '유효하지 않은 접근이에요. 다시 시도해 주세요.',
  AUTH_010: 'SSAFY 계정 정보를 가져오지 못했어요.',
  AUTH_012: 'SSAFY 계정에 이메일이 없어 가입할 수 없어요.',
};

/** SSAFY 로그인 시작 — 페이지를 통째로 이동시킵니다 */
export function startSsafyLogin() {
  window.location.href = authApi.ssafyAuthorizeUrl();
}

/**
 * SSAFY 콜백 처리 (Controller).
 *
 * 서버가 `?status=` 만 붙여 돌려보냅니다. 액세스 토큰은 주소에 실려 오지 않고,
 * 서버가 심어 준 리프레시 쿠키로 여기서 **재발급을 한 번 호출해** 받아 옵니다.
 */
export function useOauthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  const status = params.get('status');
  const errorCode = params.get('code');

  // StrictMode 의 이중 실행으로 재발급이 두 번 나가면 회전 때문에 두 번째가 실패합니다
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    if (status === 'signup') {
      navigate(ROUTES.OAUTH_SIGNUP, { replace: true });
      return;
    }

    if (status !== 'success') {
      toast.error(ERROR_MESSAGE[errorCode ?? ''] ?? 'SSAFY 로그인에 실패했어요. 다시 시도해 주세요.');
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }

    authApi
      .refresh()
      .then((tokens) => {
        setAccessToken(tokens.accessToken);
        void queryClient.invalidateQueries({ queryKey: authKeys.all });
        navigate(ROUTES.HOME, { replace: true });
      })
      .catch(() => {
        toast.error('로그인을 마치지 못했어요. 다시 시도해 주세요.');
        navigate(ROUTES.LOGIN, { replace: true });
      });
  }, [status, errorCode, navigate, setAccessToken]);
}

/** 추가정보 입력 화면이 SSAFY 가 알려준 값을 미리 채울 때 씁니다 */
export function usePendingOauthSignup() {
  return useQuery({
    queryKey: authKeys.oauthPending(),
    queryFn: authApi.oauthPending,
    staleTime: STALE_TIME.SHORT,
    retry: false,
  });
}

/** 닉네임·전화번호를 채워 가입을 끝내고 곧바로 로그인 상태가 됩니다 */
export function useOauthSignup() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (body: OauthSignupRequest) => authApi.oauthSignup(body),
    onSuccess: (res) => {
      setSession(res.user, res.accessToken);
      void queryClient.invalidateQueries({ queryKey: authKeys.all });
      navigate(ROUTES.HOME, { replace: true });
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '가입에 실패했어요.'),
  });
}
