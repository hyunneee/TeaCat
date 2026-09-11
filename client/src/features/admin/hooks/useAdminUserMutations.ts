import { useMutation } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { adminKeys, adminUserApi } from '../api/adminUserApi';
import type { AdminUserCreateRequest, AdminUserUpdateRequest } from '../model/adminUser.types';

/**
 * 회원을 바꾸는 동작들.
 *
 * 모두 성공하면 **목록과 통계를 함께** 무효화합니다. 역할을 바꾸면 역할별
 * 카운트가 달라지고, 생성·탈퇴는 전체 수가 달라집니다. 하나만 갱신하면
 * 표와 카드의 숫자가 어긋나 보입니다.
 */
function invalidateUsers() {
  // users() 하위(목록·상세·통계)를 한 번에 — 키 계층을 만든 이유입니다
  void queryClient.invalidateQueries({ queryKey: adminKeys.users() });
}

/** 서버가 내려준 메시지를 그대로 보여줍니다 (중복 이메일·마지막 관리자 등) */
const showError = (error: unknown, fallback: string) =>
  toast.error(ApiError.isApiError(error) ? error.message : fallback);

export function useCreateAdminUser(onDone?: () => void) {
  return useMutation({
    mutationFn: (body: AdminUserCreateRequest) => adminUserApi.create(body),
    onSuccess: (user) => {
      invalidateUsers();
      toast.success(`${user.nickname} 회원을 만들었어요.`);
      onDone?.();
    },
    onError: (error) => showError(error, '회원 생성에 실패했어요.'),
  });
}

export function useUpdateAdminUser(onDone?: () => void) {
  return useMutation({
    mutationFn: ({ userId, body }: { userId: number; body: AdminUserUpdateRequest }) =>
      adminUserApi.update(userId, body),
    onSuccess: (user) => {
      invalidateUsers();
      toast.success(`${user.nickname} 정보를 수정했어요.`);
      onDone?.();
    },
    onError: (error) => showError(error, '수정에 실패했어요.'),
  });
}

export function useResetAdminUserPassword(onDone?: () => void) {
  return useMutation({
    mutationFn: ({ userId, newPassword }: { userId: number; newPassword: string }) =>
      adminUserApi.resetPassword(userId, newPassword),
    onSuccess: () => {
      // 목록에 비밀번호는 안 보이지만, 서버가 그 회원 세션을 끊었으니 상세를 다시 받습니다
      invalidateUsers();
      toast.success('비밀번호를 초기화했어요. 그 회원의 로그인은 모두 해제됩니다.');
      onDone?.();
    },
    onError: (error) => showError(error, '초기화에 실패했어요.'),
  });
}

export function useDeleteAdminUserFace(onDone?: () => void) {
  return useMutation({
    mutationFn: (userId: number) => adminUserApi.deleteFace(userId),
    onSuccess: () => {
      invalidateUsers();
      toast.info('얼굴 정보를 삭제했어요. 재등록은 본인만 할 수 있어요.');
      onDone?.();
    },
    onError: (error) => showError(error, '삭제에 실패했어요.'),
  });
}

/** 탈퇴 처리 — 되돌릴 수 없습니다. 부르는 쪽에서 확인 모달을 먼저 띄우세요 */
export function useWithdrawAdminUser(onDone?: () => void) {
  return useMutation({
    mutationFn: (userId: number) => adminUserApi.withdraw(userId),
    onSuccess: () => {
      invalidateUsers();
      toast.info('회원을 탈퇴 처리했어요.');
      onDone?.();
    },
    onError: (error) => showError(error, '탈퇴 처리에 실패했어요.'),
  });
}
