import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/shared/api';
import { toast } from '@/shared/stores';
import { ROUTES } from '@/shared/constants';
import { authApi } from '../api/authApi';
import type { SignupRequest } from '../model/auth.types';

/**
 * 회원가입.
 *
 * 가입에 성공해도 **자동으로 로그인시키지 않습니다.**
 * 완료 화면을 한 번 보여주고 사용자가 직접 로그인하게 합니다.
 * (가입과 로그인이 한 번에 일어나면 "가입이 된 건가?" 하고 헷갈립니다)
 */
export function useSignup() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (body: SignupRequest) => authApi.signup(body),
    onSuccess: () => {
      navigate(ROUTES.SIGNUP_DONE, { replace: true });
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '가입에 실패했어요.'),
  });
}
