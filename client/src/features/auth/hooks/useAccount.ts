import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { ROUTES } from '@/shared/constants';
import { authApi, authKeys } from '../api/authApi';
import { useAuthStore } from '../store/authStore';
import type { ChangeNicknameRequest, ChangePasswordRequest, User } from '../model/auth.types';

/**
 * 비밀번호 변경.
 *
 * 🔴 성공하면 **로그아웃됩니다.** 서버가 이 회원의 리프레시 토큰을 전부 폐기하기 때문입니다
 * (다른 기기에 남아 있던 세션을 끊는 것이 목적입니다 — server UserService.changePassword).
 *
 * 그래서 여기서 세션을 정리하고 로그인 화면으로 보냅니다. 이걸 안 하면 액세스 토큰이
 * 만료되는 최대 1시간 동안 "로그인된 것처럼 보이지만 재발급은 실패하는" 상태가 남습니다.
 */
export function useChangePassword() {
  const navigate = useNavigate();
  const clear = useAuthStore((s) => s.clear);

  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => authApi.changePassword(body),
    onSuccess: () => {
      clear();
      queryClient.clear();
      toast.success('비밀번호가 변경됐어요. 다시 로그인해 주세요.');
      navigate(ROUTES.LOGIN, { replace: true });
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '변경에 실패했어요.'),
  });
}

export function useChangeNickname() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (body: ChangeNicknameRequest) => authApi.changeNickname(body),
    onSuccess: (_data, body) => {
      // 내 정보의 원본은 쿼리 캐시 하나입니다. 재조회 전에 화면이 뒤로 가므로 먼저 갱신합니다.
      queryClient.setQueryData(authKeys.me(), (prev: User | undefined) =>
        prev ? { ...prev, nickname: body.nickname } : prev,
      );
      void queryClient.invalidateQueries({ queryKey: authKeys.me() });
      toast.success('닉네임이 변경됐어요.');
      navigate(-1);
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '변경에 실패했어요.'),
  });
}

export function useWithdraw() {
  const navigate = useNavigate();
  const clear = useAuthStore((s) => s.clear);

  return useMutation({
    mutationFn: () => authApi.withdraw(),
    onSuccess: () => {
      clear();
      queryClient.clear();
      toast.info('탈퇴가 완료됐어요.');
      navigate(ROUTES.LOGIN, { replace: true });
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '탈퇴에 실패했어요.'),
  });
}
