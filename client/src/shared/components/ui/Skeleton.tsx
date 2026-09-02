import { cn } from '@/shared/lib';

/** 로딩 중 자리 표시. 레이아웃 점프(CLS)를 막습니다. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded-lg bg-[length:200%_100%]',
        'bg-[linear-gradient(100deg,var(--color-surface-1)_30%,var(--color-surface-3)_50%,var(--color-surface-1)_70%)]',
        className,
      )}
    />
  );
}

/** 목록 로딩용 — 카드 n개를 미리 그려둡니다. */
export function SkeletonList({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="aspect-[3/4] w-20 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
