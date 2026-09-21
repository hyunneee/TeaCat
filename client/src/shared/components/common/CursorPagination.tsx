import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/shared/components/ui';

export function CursorPagination({
  page,
  hasNext,
  busy,
  onPrevious,
  onNext,
}: {
  page: number;
  hasNext: boolean;
  busy: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <nav aria-label="페이지 이동" className="flex items-center justify-center gap-4 py-5">
      <IconButton label="이전 페이지" disabled={page <= 1 || busy} onClick={onPrevious}>
        <ChevronLeft size={20} />
      </IconButton>
      <span aria-live="polite" className="text-sm tabular-nums">
        {page} 페이지
      </span>
      <IconButton label="다음 페이지" disabled={!hasNext || busy} onClick={onNext}>
        <ChevronRight size={20} />
      </IconButton>
    </nav>
  );
}
