import { Badge, Button, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { formatDateTime, formatPrice } from '@/shared/lib';
import {
  DECISION_TONE,
  SEVERITY_LABEL,
  SEVERITY_TONE,
  SOURCE_LABEL,
  decisionLabel,
  remainingUntil,
  ruleLabel,
} from '../model/adminTradeReview.model';
import type { TradeReviewSummary } from '../model/adminTradeReview.types';

/**
 * 이상거래 심사 표.
 *
 * 서버를 모릅니다 — props 로 받은 것만 그립니다 (CLAUDE.md 4-3).
 * 대기 목록은 오래된 것이 위(먼저 볼 것), 결정 목록은 최근 결정이 위입니다 — 정렬은 서버가 합니다.
 */
export interface AdminTradeReviewTableProps {
  reviews: TradeReviewSummary[];
  isLoading: boolean;
  /** 🔴 실패를 빈 목록으로 그리면 "심사가 없다" 로 읽힙니다 */
  isError?: boolean;
  /** 대기 목록이면 남은 시한을, 결정 목록이면 결정을 보여줍니다 */
  decided: boolean;
  selectedId: number | null;
  onSelect: (reviewId: number) => void;
}

const HEADERS = ['무게', '걸린 규칙', '카드', '경로', '거래가', '판매자 → 구매자', '열린 시각', '조치', ''] as const;

export function AdminTradeReviewTable({
  reviews,
  isLoading,
  isError,
  decided,
  selectedId,
  onSelect,
}: AdminTradeReviewTableProps) {
  if (isError) {
    return (
      <EmptyState
        title="심사 목록을 불러오지 못했어요"
        description="잠시 후 다시 시도해 주세요. 계속 실패하면 서버 로그를 확인해야 해요."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <EmptyState
        title={decided ? '결정한 심사가 없어요' : '심사 대기 중인 거래가 없어요'}
        description={
          decided
            ? '판정한 심사가 여기에 쌓여요.'
            : '규칙에 걸린 거래가 여기에 쌓여요. 정산은 그대로 진행되고, 관리자가 정상·부정을 판정해 기록해요.'
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-4xl border-collapse text-sm">
        <thead>
          <tr className="border-line border-b text-left">
            {HEADERS.map((header, i) => (
              <th
                key={header || `col-${i}`}
                scope="col"
                className="text-ink-muted px-4 py-2.5 text-xs font-medium"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {reviews.map((review) => (
            <tr
              key={review.reviewId}
              className={
                review.reviewId === selectedId
                  ? 'border-line/60 bg-surface-2 border-b last:border-0'
                  : 'border-line/60 hover:bg-surface-2 border-b last:border-0'
              }
            >
              <td className="px-4 py-3">
                <div className="flex flex-col items-start gap-1">
                  <Badge tone={SEVERITY_TONE[review.maxSeverity]}>
                    {SEVERITY_LABEL[review.maxSeverity]}
                  </Badge>
                  {!review.flagged && (
                    <span className="text-ink-subtle text-xs" title="보류 기준(높음 1개 또는 중간 2개) 미달">
                      기준 미달
                    </span>
                  )}
                </div>
              </td>

              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {review.rules.map((rule) => (
                    <Badge key={rule} tone="quiet">
                      {ruleLabel(rule)}
                    </Badge>
                  ))}
                </div>
              </td>

              <td className="max-w-xs px-4 py-3">
                <p className="text-ink truncate font-medium">{review.designName}</p>
                <p className="text-ink-muted text-xs">카드 #{review.photocardId}</p>
              </td>

              <td className="text-ink px-4 py-3">{SOURCE_LABEL[review.source]}</td>

              <td className="text-ink px-4 py-3 tabular-nums">{formatPrice(review.price)}</td>

              <td className="px-4 py-3">
                <PartyCell nickname={review.seller.nickname} appearances={review.seller.reviewAppearances90d} />
                <span className="text-ink-subtle mx-1">→</span>
                <PartyCell nickname={review.buyer.nickname} appearances={review.buyer.reviewAppearances90d} />
              </td>

              <td className="text-ink-muted px-4 py-3 text-xs tabular-nums">
                {formatDateTime(review.createdAt)}
              </td>

              <td className="px-4 py-3 text-xs">
                {decided && review.decision ? (
                  <span className="flex items-center gap-1.5">
                    <Badge tone={DECISION_TONE[review.decision]}>
                      {decisionLabel(review.decision, review.held)}
                    </Badge>
                    {review.autoApproved && <span className="text-ink-muted">시한 경과</span>}
                  </span>
                ) : review.held ? (
                  <span className="flex items-center gap-1.5">
                    <Badge tone="warning">정산 보류</Badge>
                    <span className="text-ink-muted">{remainingUntil(review.autoApproveAt)}</span>
                  </span>
                ) : (
                  <Badge tone="quiet">정산 진행</Badge>
                )}
              </td>

              <td className="px-4 py-3 text-right">
                <Button variant="ghost" size="sm" onClick={() => onSelect(review.reviewId)}>
                  열기
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 닉네임 옆에 "최근 90일 심사 등장 횟수" 를 작게. 2번 이상이면 반복 등장이라 눈에 띄게 굵게 */
function PartyCell({ nickname, appearances }: { nickname: string; appearances: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-ink">{nickname}</span>
      <span
        className={appearances >= 2 ? 'text-ink text-xs font-semibold' : 'text-ink-subtle text-xs'}
        title="최근 90일 심사 등장 횟수"
      >
        ×{appearances}
      </span>
    </span>
  );
}
