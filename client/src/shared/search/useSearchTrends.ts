import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/shared/api';
export interface SearchTrendItem {
  rank: number;
  previousRank: number | null;
  trend: 'UP' | 'DOWN' | 'SAME' | 'NEW';
  keyword: string;
  searchCount: number;
}

export interface SearchTrends {
  bucketStartedAt: string | null;
  generatedAt: string;
  nextRefreshAt: string;
  items: SearchTrendItem[];
}

const CACHE_KEY = 'teacat:search-trends:v1';
const QUERY_KEY = ['global-search-trends'] as const;

function clearCachedTrends() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // 저장소가 차단된 환경에서는 TanStack Query의 메모리 캐시만 갱신합니다.
  }
}

function cachedTrends(): SearchTrends | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as SearchTrends | null;
    return value && Date.parse(value.nextRefreshAt) > Date.now() ? value : undefined;
  } catch {
    return undefined;
  }
}

async function fetchTrends() {
  const cached = cachedTrends();
  if (cached) return cached;
  const result = await http.get<SearchTrends>('/search/trends');
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(result));
  } catch {
    // 저장소가 차단된 환경에서는 TanStack Query 메모리 캐시만 사용합니다.
  }
  return result;
}

export function useSearchTrends() {
  const queryClient = useQueryClient();
  const cached = cachedTrends();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchTrends,
    initialData: cached,
    staleTime: cached ? Math.max(0, Date.parse(cached.nextRefreshAt) - Date.now()) : 0,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!query.data) return;
    const delay = Math.max(0, Date.parse(query.data.nextRefreshAt) - Date.now()) + 1000;
    const timer = window.setTimeout(() => {
      clearCachedTrends();
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [query.data, queryClient]);
  return query;
}
