import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Search, X } from 'lucide-react';
import { useSearchTrends, type SearchTrendItem } from './useSearchTrends';
import { cn } from '@/shared/lib';
import { Input, SectionTitle } from '@/shared/components/ui';
import { DURATION } from '@/shared/lib/motion';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  className?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
  variant?: 'default' | 'topnav';
}

export function TrendingSearchInput({
  value,
  onChange,
  onSubmit,
  className,
  autoFocus,
  ariaLabel = '검색어',
  variant = 'default',
}: Props) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(value);
  };

  return (
    <form role="search" onSubmit={submit} className={cn('relative', className)}>
      {variant === 'topnav' ? (
        <div className="surface-sunken border-line flex h-10 items-center gap-2 rounded-full border px-4">
          <button type="submit" aria-label="검색 실행" className="text-ink-subtle shrink-0">
            <Search size={17} />
          </button>
          <input
            autoFocus={autoFocus}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="공연·포토카드 검색"
            aria-label={ariaLabel}
            type="search"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {value && (
            <button type="button" aria-label="입력 지우기" onClick={() => onChange('')}>
              <X size={16} className="text-ink-subtle" />
            </button>
          )}
        </div>
      ) : (
        <Input
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onClear={() => onChange('')}
          aria-label={ariaLabel}
          placeholder="공연·포토카드 검색"
          type="search"
          enterKeyHint="search"
          tone="contrast"
          leftIcon={
            <button
              type="submit"
              aria-label="검색 실행"
              className="hover:text-ink flex items-center justify-center rounded-full transition-colors"
            >
              <Search size={17} />
            </button>
          }
        />
      )}
    </form>
  );
}

function trendLabel(item: SearchTrendItem) {
  if (item.trend === 'NEW') return 'NEW';
  if (item.trend === 'SAME' || item.previousRank === null) return '—';
  return `${item.trend === 'UP' ? '↑' : '↓'}${Math.abs(item.previousRank - item.rank)}`;
}

export function SearchEntryButton({
  onOpen,
  className,
}: {
  onOpen: () => void;
  className?: string;
}) {
  const { data } = useSearchTrends();
  const items = data?.items ?? [];
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % items.length),
      2500,
    );
    return () => window.clearInterval(timer);
  }, [items.length]);
  const item = items[index % Math.max(items.length, 1)];
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="공연·포토카드 검색 화면 열기"
      className={cn(
        'surface-sunken border-line flex h-10 items-center gap-2 rounded-full border px-4 text-left text-sm',
        className,
      )}
    >
      <Search size={17} className="text-ink-subtle shrink-0" />
      <span className="relative h-6 min-w-0 flex-1 overflow-hidden" aria-hidden="true">
        {item ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`${item.rank}:${item.keyword}`}
              initial={reducedMotion ? false : { y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reducedMotion ? undefined : { y: -16, opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : DURATION.base }}
              className="absolute inset-0 flex items-center gap-2"
            >
              <strong className="text-accent-800 tabular-nums">{item.rank}</strong>
              <span className="truncate">{item.keyword}</span>
              <span className="text-ink-subtle ml-auto shrink-0 text-xs">{trendLabel(item)}</span>
            </motion.span>
          </AnimatePresence>
        ) : (
          <span>공연·포토카드 검색</span>
        )}
      </span>
    </button>
  );
}

export function SearchTrendList({ onSelect }: { onSelect: (keyword: string) => void }) {
  const { data, isPending, isError, refetch } = useSearchTrends();
  return (
    <section className="w-full p-4 lg:mx-auto lg:max-w-xl lg:px-8 lg:pt-8" aria-label="인기 검색어">
      <SectionTitle
        description={`매시간 갱신${data?.bucketStartedAt ? ` · ${data.bucketStartedAt.replace('T', ' ').slice(0, 16)}부터 1시간 집계` : ''}`}
      >
        인기 검색어
      </SectionTitle>
      {isPending ? (
        <p className="mt-4" role="status">
          인기 검색어를 불러오는 중이에요.
        </p>
      ) : isError ? (
        <div className="mt-4">
          <p>인기 검색어를 불러오지 못했어요.</p>
          <button type="button" onClick={() => void refetch()}>
            다시 시도
          </button>
        </div>
      ) : !data?.items.length ? (
        <p className="text-ink-subtle mt-4 text-sm">
          아직 집계된 인기 검색어가 없어요. 검색어를 직접 입력해 주세요.
        </p>
      ) : (
        <ol className="mt-3 lg:mt-6 lg:space-y-1">
          {data.items.map((item) => (
            <li key={item.keyword}>
              <button
                type="button"
                onClick={() => onSelect(item.keyword)}
                className="hover:bg-canvas flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left lg:min-h-12 lg:px-4"
              >
                <strong className="text-accent-800 w-6 tabular-nums">{item.rank}</strong>
                <span className="min-w-0 flex-1 truncate">{item.keyword}</span>
                <span className="text-ink-subtle text-xs">{trendLabel(item)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
