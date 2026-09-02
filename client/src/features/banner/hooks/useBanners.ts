import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { bannerApi, bannerKeys } from '../api/bannerApi';

/** 배너는 자주 바뀌지 않으므로 길게 캐시합니다. */
export function useBanners() {
  return useQuery({
    queryKey: bannerKeys.list(),
    queryFn: () => bannerApi.list(),
    staleTime: STALE_TIME.LONG,
  });
}
