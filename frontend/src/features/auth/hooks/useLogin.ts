import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { ROUTES } from '@/shared/constants';
import { authApi, authKeys } from '../api/authApi';
import { useAuthStore } from '../store/authStore';
import type { LoginRequest } from '../model/auth.types';

export function useLogin() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: (res) => {
      setSession(res.user, res.accessToken);
      void queryClient.invalidateQueries({ queryKey: authKeys.all });

      // 얼굴 등록이 안 돼 있으면 바로 등록 화면으로 유도.
      // (티켓이 유효하려면 얼굴 등록이 선행돼야 하므로)
      navigate(res.user.faceRegistered ? ROUTES.HOME : ROUTES.FACE_REGISTER, { replace: true });
    },
    onError: () => toast.error('아이디 또는 비밀번호를 확인해 주세요.'),
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
