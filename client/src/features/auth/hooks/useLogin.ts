import { useMutation } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { ROUTES } from '@/shared/constants';
import { can } from '../model/permission';
import { authApi, authKeys } from '../api/authApi';
import { useAuthStore } from '../store/authStore';
import type { LoginRequest } from '../model/auth.types';

/** RequireAuth 가드가 넘겨준 "원래 가려던 곳" */
interface LoginLocationState {
  from?: { pathname?: string; search?: string };
}

export function useLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: (res) => {
      setSession(res.user, res.accessToken);
      void queryClient.invalidateQueries({ queryKey: authKeys.all });

      // 얼굴 등록은 마이페이지에서 합니다. 로그인 직후 카메라로 끌고 가지 않습니다.
      //
      // 가드에 막혀 로그인 화면으로 온 사람은 원래 가려던 곳으로 돌려보냅니다.
      // (/my/tickets 를 열려다 로그인했는데 홈으로 떨어지면 다시 찾아가야 합니다)
      //
      // 🔴 외부에서 넘어온 값이라 pathname 만 씁니다. state.from 을 그대로 믿고
      //    절대 URL 을 넣으면 로그인 후 외부 사이트로 보내는 통로가 됩니다.
      const from = (location.state as LoginLocationState | null)?.from;
      const wanted =
        from?.pathname && from.pathname.startsWith('/') && !from.pathname.startsWith('//')
          ? `${from.pathname}${from.search ?? ''}`
          : null;

      /* 가려던 곳이 있으면 그게 우선입니다 — 가드에 막혀 로그인한 사람을
         엉뚱한 데로 보내면 안 됩니다.
         그게 없으면 운영 역할은 콘솔로, 일반 회원은 홈으로 보냅니다. */
      navigate(wanted ?? (can.accessAdmin(res.user) ? ROUTES.ADMIN : ROUTES.HOME), {
        replace: true,
      });
    },
    onError: () => toast.error('이메일 또는 비밀번호를 확인해 주세요.'),
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const clear = useAuthStore((s) => s.clear);

  return useMutation({
    mutationFn: () => authApi.logout(),
    // 서버 응답과 무관하게 클라이언트는 반드시 정리한다.
    onSettled: () => {
      clear();
      queryClient.clear();
      navigate(ROUTES.LOGIN, { replace: true });
    },
  });
}
