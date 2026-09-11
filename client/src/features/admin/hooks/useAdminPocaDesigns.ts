import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { STALE_TIME } from '@/shared/constants';
import { adminPocaDesignApi, adminPocaDesignKeys } from '../api/adminPocaDesignApi';
import type { AdminPocaDesignCreateRequest } from '../model/adminPocaDesign.types';

const message = (error: unknown, fallback: string) =>
  ApiError.isApiError(error) ? error.message : fallback;

/** 온체인 확정을 기다리는 동안만 다시 물어보는 간격 */
const CHAIN_POLL_MS = 5000;

/**
 * 뽑기 풀 도안 목록.
 *
 * 등록 직후에는 `REGISTERING` 이고 블록이 확정되면 `REGISTERED` 가 됩니다.
 * 🔴 그동안만 다시 물어봅니다 — 안 그러면 "등록 중" 이 영영 그대로 남습니다.
 * 확정되면 스스로 멈춥니다.
 */
export function useAdminDrawPoolDesigns() {
  return useQuery({
    queryKey: adminPocaDesignKeys.drawPool(),
    queryFn: adminPocaDesignApi.drawPool,
    staleTime: STALE_TIME.SHORT,
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.chainStatus === 'REGISTERING') ? CHAIN_POLL_MS : false,
  });
}

export function useCreatePocaDesign() {
  return useMutation({
    mutationFn: (body: AdminPocaDesignCreateRequest) => adminPocaDesignApi.create(body),
    /* IPFS 핀 + 온체인 등록까지 한 번에 도는 요청이라 느립니다. 재시도가 붙으면 같은 그림이 두 번 올라갑니다 */
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminPocaDesignKeys.all });
      toast.success('도안을 등록했어요.');
    },
    onError: (error) => toast.error(message(error, '도안을 등록하지 못했어요.')),
  });
}

/** 핀은 끝났는데 온체인 등록이 안 된 도안을 다시 보냅니다 — 그림을 다시 올리지 않습니다 */
export function useRetryDesignRegistration() {
  return useMutation({
    mutationFn: ({ designId, force }: { designId: number; force?: boolean }) =>
      adminPocaDesignApi.retryRegistration(designId, force),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminPocaDesignKeys.all });
      toast.success('등록 요청을 보냈어요.');
    },
    onError: (error) => toast.error(message(error, '등록을 다시 보내지 못했어요.')),
  });
}
