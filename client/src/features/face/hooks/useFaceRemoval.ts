import { useMutation } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { authKeys, type User } from '@/features/auth';
import { faceApi } from '../api/faceApi';

/**
 * 등록된 얼굴 삭제.
 *
 * 등록과 마찬가지로 내 정보의 원본은 **쿼리 캐시 하나**입니다.
 * 삭제 후 캐시를 즉시 내려놓지 않으면 "삭제했는데 등록됨으로 보이는" 상태가 남습니다.
 */
export function useFaceRemoval() {
  return useMutation({
    mutationFn: () => faceApi.remove(),
    onSuccess: () => {
      queryClient.setQueryData(authKeys.me(), (prev: User | undefined) =>
        prev ? { ...prev, faceRegistered: false } : prev,
      );
      void queryClient.invalidateQueries({ queryKey: authKeys.me() });
      toast.info('삭제했어요.');
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '삭제에 실패했어요.'),
  });
}
