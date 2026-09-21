import { useState } from 'react';
import { Card, ConfirmModal, Segmented } from '@/shared/components/ui';
import {
  AdminPagination,
  AdminTradeReviewDetailModal,
  AdminTradeReviewTable,
  AdminTradeTable,
  BentoGrid,
  StatTile,
  TRADE_FILTER_OPTIONS,
  useAdminTradeReview,
  useAdminTradeReviewStats,
  useAdminTradeReviews,
  useAdminTrades,
  useApproveTradeReview,
  useRejectTradeReview,
  type TradeFilter,
} from '@/features/admin';

type Tab = 'OPEN' | 'DECIDED' | 'TRADES';

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: 'OPEN', label: '심사 대기' },
  { value: 'DECIDED', label: '심사 완료' },
  { value: 'TRADES', label: '전체 거래' },
];

/**
 * 거래 심사 — 이상거래 규칙에 걸려 정산이 멈춘 거래를 보고 승인·거절하고, 전체 거래 내역을 한 표로 봅니다.
 *
 * 페이지는 조립만 합니다 — 훅을 불러 컴포넌트에 내려줍니다 (CLAUDE.md 3-6).
 * 접근 제어는 라우터의 `RequireRole(['ADMIN'])` 이 이미 끝냈습니다.
 * 설계: server/AUCTION_FRAUD_DESIGN.md
 */
export function AdminTradeReviewsPage() {
  const [tab, setTab] = useState<Tab>('OPEN');
  const reviews = useAdminTradeReviews();
  const trades = useAdminTrades();
  const stats = useAdminTradeReviewStats();

  /** 지금 열어 놓은 심사. 표 어디서 열었든(심사 목록·거래 내역) 같은 모달입니다 */
  const [openedId, setOpenedId] = useState<number | null>(null);
  const opened = useAdminTradeReview(openedId);

  /** 거절·부정 판정은 되돌릴 수 없어 사유를 받은 뒤 한 번 더 묻습니다 (CLAUDE.md 4-7) */
  const [pendingReject, setPendingReject] = useState<{ reviewId: number; note: string; held: boolean } | null>(
    null,
  );

  const approve = useApproveTradeReview();
  const reject = useRejectTradeReview();

  const switchTab = (next: Tab) => {
    setTab(next);
    if (next === 'OPEN' || next === 'DECIDED') reviews.filterStatus(next);
  };

  const reviewPage = reviews.data;
  const tradePage = trades.data;
  const s = stats.data;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold text-ink">거래 심사</h1>
        <p className="text-sm text-ink-muted">
          이상거래 규칙에 걸린 거래가 여기에 쌓여요. 정산은 그대로 진행되고, 관리자가 정상·부정을 판정해
          기록으로 남겨요. 이 기록이 나중에 규칙을 조정하는 근거가 돼요.
        </p>
      </div>

      <BentoGrid>
        <StatTile span={4} label="결정 대기" value={s?.open} unit="건" />
        <StatTile span={4} label={`${s?.windowDays ?? 30}일 심사`} value={s?.reviews} unit="건" />
        <StatTile span={4} label="승인" value={s?.approved} unit="건" />
        <StatTile span={4} label="거절" value={s?.rejected} unit="건" />
        <StatTile span={4} label="자동 승인" value={s?.autoApproved} unit="건" caption="시한 경과" />
        <StatTile span={4} label={`${s?.windowDays ?? 30}일 거래`} value={s?.trades} unit="건" />
      </BentoGrid>

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 border-b border-line p-4">
          <Segmented options={TAB_OPTIONS} value={tab} onChange={(v) => switchTab(v as Tab)} />
          {tab === 'TRADES' && (
            <Segmented
              options={TRADE_FILTER_OPTIONS}
              value={trades.status}
              onChange={(v) => trades.filterStatus(v as TradeFilter)}
            />
          )}
        </div>

        {tab === 'TRADES' ? (
          <>
            <AdminTradeTable
              trades={tradePage?.trades ?? []}
              isLoading={trades.isPending}
              onOpenReview={setOpenedId}
            />
            <AdminPagination
              page={tradePage?.page ?? 0}
              totalPages={tradePage?.totalPages ?? 0}
              totalElements={tradePage?.totalElements ?? 0}
              unit="건"
              onChange={trades.setPage}
            />
          </>
        ) : (
          <>
            <AdminTradeReviewTable
              reviews={reviewPage?.reviews ?? []}
              isLoading={reviews.isPending}
              decided={tab === 'DECIDED'}
              selectedId={openedId}
              onSelect={setOpenedId}
            />
            <AdminPagination
              page={reviewPage?.page ?? 0}
              totalPages={reviewPage?.totalPages ?? 0}
              totalElements={reviewPage?.totalElements ?? 0}
              unit="건"
              onChange={reviews.setPage}
            />
          </>
        )}
      </Card>

      {openedId !== null && (
        <AdminTradeReviewDetailModal
          detail={opened.data}
          isLoading={opened.isPending}
          approving={approve.isPending}
          rejecting={reject.isPending}
          onClose={() => setOpenedId(null)}
          onApprove={(note) =>
            approve.mutate({ reviewId: openedId, note }, { onSuccess: () => setOpenedId(null) })
          }
          onReject={(note) =>
            setPendingReject({ reviewId: openedId, note, held: opened.data?.summary.held ?? false })
          }
        />
      )}

      {pendingReject && (
        <ConfirmModal
          danger
          title={pendingReject.held ? '이 거래를 거절할까요?' : '부정 거래로 판정할까요?'}
          message={
            pendingReject.held
              ? '구매자와 판매자의 묶인 캣머니가 풀리고 거래는 실패로 끝나요. 카드는 판매자에게 남고, 되돌릴 수 없어요.'
              : '거래는 이미 정산돼 돈은 움직이지 않아요. 판정은 기록으로 남고 되돌릴 수 없어요.'
          }
          confirmText={pendingReject.held ? '거절' : '부정으로 판정'}
          onConfirm={() => {
            const { reviewId, note } = pendingReject;
            setPendingReject(null);
            reject.mutate({ reviewId, note }, { onSuccess: () => setOpenedId(null) });
          }}
          onCancel={() => setPendingReject(null)}
          onClose={() => setPendingReject(null)}
        />
      )}
    </div>
  );
}
