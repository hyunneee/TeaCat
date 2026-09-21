import { useQuery } from '@tanstack/react-query';
import { rankingApi, rankingKeys } from '../api/rankingApi';

const STALE_TIME = 45_000;

export function usePopularConcerts() {
  return useQuery({
    queryKey: rankingKeys.concerts,
    queryFn: rankingApi.concerts,
    staleTime: STALE_TIME,
  });
}

export function usePopularPhotocards() {
  return useQuery({
    queryKey: rankingKeys.photocards,
    queryFn: rankingApi.photocards,
    staleTime: STALE_TIME,
  });
}
