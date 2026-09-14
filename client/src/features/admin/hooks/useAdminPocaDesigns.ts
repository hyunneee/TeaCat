import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { STALE_TIME } from '@/shared/constants';
import { adminPocaDesignApi, adminPocaDesignKeys } from '../api/adminPocaDesignApi';
import type {
  AdminPocaDesign,
  AdminPocaTemplateCreateRequest,
  PocaPoolItem,
} from '../model/adminPocaDesign.types';

const message = (error: unknown, fallback: string) =>
  ApiError.isApiError(error) ? error.message : fallback;

/** 온체인 확정을 기다리는 동안만 다시 물어보는 간격 */
const CHAIN_POLL_MS = 5000;

/** 등록 중인 도안이 하나라도 있으면 다시 물어봅니다. 다 끝나면 스스로 멈춥니다 */
const whileRegistering = (designs: AdminPocaDesign[] | undefined) =>
  designs?.some((d) => d.chainStatus === 'REGISTERING') ? CHAIN_POLL_MS : false;

/* ── 템플릿 ───────────────────────────────────────────── */

export function useAdminPocaTemplates() {
  return useQuery({
    queryKey: adminPocaDesignKeys.templates(),
    queryFn: adminPocaDesignApi.templates,
    staleTime: STALE_TIME.SHORT,
  });
}

export function useCreatePocaTemplate() {
  return useMutation({
    mutationFn: (body: AdminPocaTemplateCreateRequest) => adminPocaDesignApi.createTemplate(body),
    /* 그림을 IPFS 에 올리는 요청이라 느립니다. 자동 재시도가 붙으면 같은 그림이 두 번 올라갑니다 */
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminPocaDesignKeys.templates() });
      toast.success('카드 그림을 등록했어요.');
    },
    onError: (error) => toast.error(message(error, '카드 그림을 등록하지 못했어요.')),
  });
}

/** 감추기/되살리기 — 삭제가 아닙니다. 이미 만든 도안은 그대로 동작합니다 */
export function useSetTemplateHidden() {
  return useMutation({
    mutationFn: ({ templateId, hidden }: { templateId: number; hidden: boolean }) =>
      adminPocaDesignApi.setTemplateHidden(templateId, hidden),
    onSuccess: (_, { hidden }) => {
      void queryClient.invalidateQueries({ queryKey: adminPocaDesignKeys.templates() });
      toast.success(hidden ? '목록에서 감췄어요.' : '다시 보이게 했어요.');
    },
    onError: (error) => toast.error(message(error, '바꾸지 못했어요.')),
  });
}

/* ── 공연별 뽑기 풀 ───────────────────────────────────── */

export function usePerformanceDrawPool(performanceId: number) {
  return useQuery({
    queryKey: adminPocaDesignKeys.performancePool(performanceId),
    queryFn: () => adminPocaDesignApi.performancePool(performanceId),
    staleTime: STALE_TIME.SHORT,
    enabled: Number.isInteger(performanceId) && performanceId > 0,
    refetchInterval: (query) => whileRegistering(query.state.data?.designs),
  });
}

export function useAddPerformanceDesigns(performanceId: number) {
  return useMutation({
    mutationFn: (items: PocaPoolItem[]) =>
      adminPocaDesignApi.addPerformanceDesigns(performanceId, items),
    /* 온체인에 박히는 요청입니다. 자동 재시도로 같은 카드가 두 벌 올라가면 되돌릴 수 없습니다 */
    retry: false,
    onSuccess: (pool) => {
      /* 응답이 갱신된 풀 전체라 그대로 캐시에 앉힙니다 — 다시 부를 이유가 없습니다 */
      queryClient.setQueryData(adminPocaDesignKeys.performancePool(performanceId), pool);
      toast.success('카드를 공연에 넣었어요.');
    },
    onError: (error) => toast.error(message(error, '카드를 넣지 못했어요.')),
  });
}

/* ── 이벤트 풀 ────────────────────────────────────────── */

export function useAdminEventPoolDesigns() {
  return useQuery({
    queryKey: adminPocaDesignKeys.eventPool(),
    queryFn: adminPocaDesignApi.eventPool,
    staleTime: STALE_TIME.SHORT,
    refetchInterval: (query) => whileRegistering(query.state.data),
  });
}

export function useAddEventPoolDesigns() {
  return useMutation({
    mutationFn: (items: PocaPoolItem[]) => adminPocaDesignApi.addEventPoolDesigns(items),
    retry: false,
    onSuccess: () => {
      /* 응답은 새로 만든 것뿐이라 목록을 다시 읽습니다 */
      void queryClient.invalidateQueries({ queryKey: adminPocaDesignKeys.eventPool() });
      toast.success('카드를 이벤트 풀에 넣었어요.');
    },
    onError: (error) => toast.error(message(error, '카드를 넣지 못했어요.')),
  });
}

/* ── 도안 ─────────────────────────────────────────────── */

/** 뽑기에서 빼기/넣기 — 삭제가 아닙니다 */
export function useSetDesignDrawPool() {
  return useMutation({
    mutationFn: ({ designId, drawPool }: { designId: number; drawPool: boolean }) =>
      adminPocaDesignApi.setDrawPool(designId, drawPool),
    onSuccess: (_, { drawPool }) => {
      void queryClient.invalidateQueries({ queryKey: adminPocaDesignKeys.all });
      toast.success(drawPool ? '다시 뽑히게 했어요.' : '뽑기에서 제외했어요.');
    },
    onError: (error) => toast.error(message(error, '바꾸지 못했어요.')),
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
