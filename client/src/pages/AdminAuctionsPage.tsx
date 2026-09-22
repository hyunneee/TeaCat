import { useState } from 'react';
import { Search } from 'lucide-react';
import { Card, ConfirmModal, Input, Segmented } from '@/shared/components/ui';
import {
  AUCTION_STATUS_OPTIONS,
  AdminAuctionDetailModal,
  AdminAuctionTable,
  AdminPagination,
  useAdminAuction,
  useAdminAuctions,
  useCancelAuction,
  type AdminAuctionStatus,
} from '@/features/admin';

/**
 * 경매 관리 — 모든 상태의 경매를 보고, 진행 중인 경매를 강제로 취소합니다.
 *
 * 페이지는 조립만 합니다 — 훅을 불러 컴포넌트에 내려줍니다 (CLAUDE.md 3-6).
 * 접근 제어는 라우터의 `RequireRole(['ADMIN'])` 이 이미 끝냈습니다.
 *
 * 🔴 강제 취소는 **판매자가 할 수 없는 일**입니다. 판매자 취소는 입찰이 하나라도 있으면
 *    막히기 때문에(AUCTION_HAS_BIDS), 부정 입찰·사칭이 붙은 경매를 되돌리는 길은 여기뿐입니다.
 */
export function AdminAuctionsPage() {
  const auctions = useAdminAuctions();

  /** 지금 열어 놓은 경매. 표에서 "자세히" 로 엽니다 */
  const [openedId, setOpenedId] = useState<number | null>(null);
  const opened = useAdminAuction(openedId);

  /** 강제 취소는 되돌릴 수 없어 사유를 받은 뒤 한 번 더 묻습니다 (CLAUDE.md 4-7) */
  const [pendingCancel, setPendingCancel] = useState<{ auctionId: number; reason: string } | null>(
    null,
  );

  const cancel = useCancelAuction();
  const page = auctions.data;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-ink text-lg font-bold">경매 관리</h1>
        <p className="text-ink-muted text-sm">
          사용자가 올린 포토카드 경매를 모든 상태로 봐요. 부정 입찰이나 사칭 신고가 들어오면 진행 중인
          경매를 강제로 취소할 수 있고, 최고 입찰자의 캣머니 담보는 함께 풀려요.
        </p>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="border-line flex flex-wrap items-center gap-3 border-b p-4">
          <Segmented
            options={AUCTION_STATUS_OPTIONS}
            value={auctions.status}
            onChange={(v) => auctions.filterStatus(v as AdminAuctionStatus | '')}
          />
          {/* 어드민은 사람을 기준으로 뒤집니다 — 판매자 닉네임도 검색에 들어갑니다 */}
          <div className="min-w-56 flex-1">
            <Input
              value={auctions.keyword}
              onChange={(e) => auctions.search(e.target.value)}
              onClear={() => auctions.search('')}
              placeholder="카드 이름, 공연, 판매자 닉네임"
              leftIcon={<Search size={16} />}
              type="search"
            />
          </div>
        </div>

        <AdminAuctionTable
          auctions={page?.auctions ?? []}
          isLoading={auctions.isPending}
          isError={auctions.isError}
          filtered={auctions.status !== '' || auctions.keyword.trim().length > 0}
          selectedId={openedId}
          onSelect={setOpenedId}
        />

        <AdminPagination
          page={page?.page ?? 0}
          totalPages={page?.totalPages ?? 0}
          totalElements={page?.totalElements ?? 0}
          unit="건"
          onChange={auctions.setPage}
        />
      </Card>

      {openedId !== null && (
        <AdminAuctionDetailModal
          detail={opened.data}
          isLoading={opened.isPending}
          cancelling={cancel.isPending}
          onClose={() => setOpenedId(null)}
          onCancel={(reason) => setPendingCancel({ auctionId: openedId, reason })}
        />
      )}

      {pendingCancel && (
        <ConfirmModal
          danger
          title="이 경매를 강제로 취소할까요?"
          message="경매가 닫히고 최고 입찰자의 캣머니 담보가 풀려요. 카드는 판매자에게 남고, 되돌릴 수 없어요."
          confirmText="강제 취소"
          onConfirm={() => {
            const { auctionId, reason } = pendingCancel;
            setPendingCancel(null);
            cancel.mutate({ auctionId, reason }, { onSuccess: () => setOpenedId(null) });
          }}
          onCancel={() => setPendingCancel(null)}
          onClose={() => setPendingCancel(null)}
        />
      )}
    </div>
  );
}
