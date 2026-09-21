import { cn } from '@/shared/lib';
import {
  OPERATIONS_SEAT_FILL,
  OPERATIONS_SEAT_LABEL,
  OPERATIONS_SEAT_LEGEND,
} from '../model/operations.model';

/**
 * 좌석 색 범례.
 *
 * 다섯 가지 색이 무엇인지 화면에 없으면 운영자가 색을 추측합니다. 순서와 문구는
 * `operations.model` 한곳에 있습니다 — 여기서 다시 적지 마세요.
 */
export function OperationsSeatLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {OPERATIONS_SEAT_LEGEND.map((state) => (
        <li key={state} className="text-ink-muted flex items-center gap-1.5 text-xs">
          {/* 색은 좌석과 같은 토큰을 씁니다 — 범례와 도면이 어긋나지 않게 */}
          <svg width="10" height="10" aria-hidden className="shrink-0">
            <rect width="10" height="10" rx="2.5" className={OPERATIONS_SEAT_FILL[state]} />
          </svg>
          {OPERATIONS_SEAT_LABEL[state]}
        </li>
      ))}
    </ul>
  );
}
