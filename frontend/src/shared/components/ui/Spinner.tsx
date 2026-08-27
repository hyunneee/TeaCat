import { cn } from '@/shared/lib';

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="로딩 중"
      style={{ width: size, height: size, borderWidth: Math.max(2, size / 9) }}
      className={cn(
        'inline-block animate-spin rounded-full border-current border-t-transparent opacity-80',
        className,
      )}
    />
  );
}
