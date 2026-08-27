import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { ROUTES } from '@/shared/constants';
import { authApi, authKeys } from '../api/authApi';
import { useAuthStore } from '../store/authStore';
import type { SignupRequest } from '../model/auth.types';

export function useSignup() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (body: SignupRequest) => authApi.signup(body),
    onSuccess: (res) => {
      setSession(res.user, res.accessToken);
      void queryClient.invalidateQueries({ queryKey: authKeys.all });
      toast.success('가입이 완료됐어요. 얼굴을 등록해 주세요.');
      // 가입 직후 얼굴 등록으로 유도 — 티켓 사용의 전제 조건이라서.
      navigate(ROUTES.FACE_REGISTER, { replace: true });
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '가입에 실패했어요.'),
  });
}
