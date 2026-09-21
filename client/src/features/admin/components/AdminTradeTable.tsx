import { Badge, Button, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { formatDateTime, formatPrice } from '@/shared/lib';
import {
  CHAIN_STATUS_LABEL,
  CHAIN_STATUS_TONE,
  DECISION_TONE,
  SEVERITY_LABEL,
  SEVERITY_TONE,
  SOURCE_LABEL,
  decisionLabel,
  failureLabel,
} from '../model/adminTradeReview.model';
import type { AdminTrade } from '../model/adminTradeReview.types';

/**
 * 전체 거래 내역 표.
 *
 * 심사와 무관한 거래까지 모두 보입니다. 심사에 걸린 적이 있는 줄은 마지막 열에 심사 무게·결정이 붙고
 * 거기서 심사 상세로 이어집니다. 서버를 모릅니다 — props 로 받은 것만 그립니다 (CLAUDE.md 4-3).
 */
export interface AdminTradeTableProps {
  trades: AdminTrade[];
  isLoading: boolean;
  /** 🔴 실패를 빈 목록으로 그리면 "거래가 없다" 로 읽힙니다. 실제로 그 오해가 한 번 났습니다 */
  isError?: boolean;
  onOpenReview: (reviewId: number) => void;
}

const HEADERS = ['상태', '카드', '경로', '판매자 → 구매자', '금액', '성립 시각', '완료 시각', '심사'] as const;

export function AdminTradeTable({ trades, isLoading, isError, onOpenReview }: AdminTradeTableProps) {
  if (isError) {
    return (
      <EmptyState
        title="거래 내역을 불러오지 못했어요"
        description="잠시 후 다시 시도해 주세요. 계속 실패하면 서버 로그를 확인해야 해요."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (trades.length === 0) {
    return <EmptyState title="조건에 맞는 거래가 없어요" description="상태 필터를 바꿔보세요." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-4xl border-collapse text-sm">
        <thead>
          <tr className="border-line border-b text-left">
            {HEADERS.map((header) => (
              <th key={header} scope="col" className="text-ink-muted px-4 py-2.5 text-xs font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {trades.map((trade) => {
            const failure = failureLabel(trade.failureCode);
            return (
              <tr key={trade.tradeId} className="border-line/60 hover:bg-surface-2 border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <Badge tone={CHAIN_STATUS_TONE[trade.chainStatus]}>
                      {CHAIN_STATUS_LABEL[trade.chainStatus]}
                    </Badge>
                    {failure && <span className="text-ink-muted text-xs">{failure}</span>}
                  </div>
                </td>

                <td className="max-w-xs px-4 py-3">
                  <p className="text-ink truncate font-medium">{trade.designName}</p>
                  <p className="text-ink-muted text-xs">
                    카드 #{trade.photocardId} · 거래 #{trade.tradeId}
                  </p>
                </td>

                <td className="text-ink px-4 py-3">{SOURCE_LABEL[trade.source]}</td>

                <td className="text-ink px-4 py-3">
                  {trade.sellerNickname}
                  <span className="text-ink-subtle mx-1">→</span>
                  {trade.buyerNickname}
                </td>

                <td className="text-ink px-4 py-3 tabular-nums">{formatPrice(trade.price)}</td>

                <td className="text-ink-muted px-4 py-3 text-xs tabular-nums">
                  {formatDateTime(trade.createdAt)}
                </td>

                <td className="text-ink-muted px-4 py-3 text-xs tabular-nums">
                  {trade.completedAt ? formatDateTime(trade.completedAt) : '—'}
                </td>

                <td className="px-4 py-3">
                  {trade.reviewId === null ? (
                    <span className="text-ink-subtle text-xs">통과</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {trade.reviewSeverity && (
                        <Badge tone={SEVERITY_TONE[trade.reviewSeverity]}>
                          {SEVERITY_LABEL[trade.reviewSeverity]}
                        </Badge>
                      )}
                      {trade.reviewDecision ? (
                        <Badge tone={DECISION_TONE[trade.reviewDecision]}>
                          {decisionLabel(trade.reviewDecision, trade.reviewHeld)}
                        </Badge>
                      ) : (
                        <span className="text-ink-muted text-xs">판정 대기</span>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => onOpenReview(trade.reviewId as number)}>
                        심사 보기
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
