import { useQuery } from '@tanstack/react-query';
import { searchApi, searchKeys } from '../api/searchApi';

export function useUnifiedSearch(keyword: string) {
  return useQuery({
    queryKey: searchKeys.result(keyword),
    queryFn: () => searchApi.search(keyword),
    enabled: keyword.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
