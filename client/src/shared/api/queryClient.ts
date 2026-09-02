import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './ApiError';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 좌석/잔여수량처럼 빨리 변하는 데이터는 각 훅에서 staleTime 을 0 으로 덮어씁니다.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        // 400번대는 재시도해도 결과가 같음 → 즉시 포기
        if (ApiError.isApiError(error) && error.isClientError) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      // 모바일에서 백그라운드 갔다 오면 최신 상태로 맞춰줌
      refetchOnReconnect: true,
    },
    mutations: {
      // 결제/예매는 자동 재시도 금지. 중복 결제 위험.
      retry: false,
    },
  },
});
