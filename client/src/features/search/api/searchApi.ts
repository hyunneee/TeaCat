import { http } from '@/shared/api';
import { getViewSessionId } from '@/shared/lib';
import type { UnifiedSearchResult } from '../model/search.types';

export const searchApi = {
  search: (keyword: string) =>
    http.post<UnifiedSearchResult>(
      '/search',
      { keyword },
      { headers: { 'X-Search-Session': getViewSessionId() } },
    ),
};

export const searchKeys = {
  all: ['search'] as const,
  result: (keyword: string) => ['search', 'result', keyword] as const,
};
