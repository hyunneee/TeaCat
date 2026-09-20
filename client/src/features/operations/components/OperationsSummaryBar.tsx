import { RotateCcw } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { formatDateTime } from '@/shared/lib';
import { checkInRatio } from '../model/operations.model';
import type { OperationsSummary } from '../model/operations.types';

interface Props {
  summary: OperationsSummary;
  /** 서버가 응답을 만든 시각. '마지막 갱신' 은 브라우저 시계가 아니라 이 값입니다 */
  serverTime: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

/**
 * 회차 집계 한 줄 (순수 View).
 *
 * 🔴 '마지막 갱신' 에 **브라우저 시각을 적지 않습니다.** 응답이 만들어진 시각을 서버가 주고,
 *    그걸 그대로 보여줍니다 — 화면이 자기 시계로 적으면 응답이 늦게 도착한 만큼 거짓이 됩니다.
 */
export function OperationsSummaryBar({ summary, serverTime, isRefreshing, onRefresh }: Props) {
  const ratio = Math.round(checkInRatio(summary.bookedCount, summary.checkedInCount) * 100);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <div className="flex items-baseline gap-1.5">
          <dt className="text-ink-muted text-xs">예매</dt>
          <dd className="text-ink font-bold tabular-nums">{summary.bookedCount}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-ink-muted text-xs">입장</dt>
          <dd className="text-ink font-bold tabular-nums">
            {summary.checkedInCount}
            <span className="text-ink-muted ml-1 text-xs font-medium">{ratio}%</span>
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-ink-muted text-xs">미입장</dt>
          <dd className="text-ink font-bold tabular-nums">{summary.notCheckedInCount}</dd>
        </div>
        {/* 선점은 결제 중이라 아직 예매가 아닙니다 — 예매 수에 더하지 않고 따로 보여줍니다 */}
        {summary.heldCount > 0 && (
          <div className="flex items-baseline gap-1.5">
            <dt className="text-ink-muted text-xs">결제 중</dt>
            <dd className="text-ink-muted font-semibold tabular-nums">{summary.heldCount}</dd>
          </div>
        )}
      </dl>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-ink-subtle text-xs tabular-nums">
          {formatDateTime(serverTime)} 기준
        </span>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RotateCcw size={15} />}
          loading={isRefreshing}
          onClick={onRefresh}
        >
          새로고침
        </Button>
      </div>
    </div>
  );
}
