import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Search, X } from 'lucide-react';
import { http } from '@/shared/api';
import { cn } from '@/shared/lib';

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

function useSearchTrends() {
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
    const timer = window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: QUERY_KEY }), delay);
    return () => window.clearTimeout(timer);
  }, [query.data, queryClient]);
  return query;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  className?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}

export function TrendingSearchInput({
  value,
  onChange,
  onSubmit,
  className,
  autoFocus,
  ariaLabel = '검색어',
}: Props) {
  const [focused, setFocused] = useState(false);
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const { data } = useSearchTrends();
  const items = data?.items ?? [];
  const rotating = !value && !focused && items.length > 0;

  useEffect(() => {
    if (!rotating || items.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), 2500);
    return () => window.clearInterval(timer);
  }, [items.length, rotating]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(value);
  };
  const item = items[index % Math.max(items.length, 1)];

  return (
    <form role="search" onSubmit={submit} className={cn('relative', className)}>
      <div className="surface-sunken border-line flex h-10 items-center gap-2 rounded-full border px-4">
        <Search size={17} className="text-ink-subtle shrink-0" />
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={items.length === 0 ? '공연·포토카드 검색' : undefined}
          aria-label={ariaLabel}
          type="search"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {value && (
          <button type="button" aria-label="검색어 지우기" onClick={() => onChange('')}>
            <X size={16} className="text-ink-subtle" />
          </button>
        )}
      </div>
      {rotating && item && (
        <button
          type="button"
          className="absolute inset-y-0 right-4 left-10 overflow-hidden text-left text-sm"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSubmit(item.keyword)}
          aria-label={`${item.rank}위 ${item.keyword} 검색`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`${item.rank}:${item.keyword}`}
              initial={reducedMotion ? false : { y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reducedMotion ? undefined : { y: -16, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 flex items-center gap-2"
            >
              <strong className="text-accent-800 tabular-nums">{item.rank}</strong>
              <span className="truncate">{item.keyword}</span>
            </motion.span>
          </AnimatePresence>
        </button>
      )}
    </form>
  );
}
