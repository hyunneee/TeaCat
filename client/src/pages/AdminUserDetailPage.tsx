import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, ConfirmModal, Segmented, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import {
  AdminCatMoneyModal,
  AdminUserPhotocardTable,
  AdminUserProfileCard,
  AdminUserTicketTable,
  AdminUserTradeTables,
  USER_DETAIL_TABS,
  useAdminUserDetail,
  useAdminUserPhotocards,
  useAdminUserPurchases,
  useAdminUserSales,
  useAdminUserTickets,
} from '@/features/admin';

/**
 * 회원 상세 (어드민 콘솔).
 *
 * 페이지는 조립만 합니다 — 훅을 불러 컴포넌트에 내려줍니다 (CLAUDE.md 3-6).
 * 접근 제어는 라우터의 `RequireRole(['ADMIN'])` 이 이미 끝냈습니다.
 */
export function AdminUserDetailPage() {
  const navigate = useNavigate();
  const { userId: userIdParam } = useParams();
  const userId = Number(userIdParam);

  const m = useAdminUserDetail(userId);

  /* 탭을 옮겨도 이미 받아온 목록은 캐시에 남아 다시 부르지 않습니다.
     그래서 네 훅을 모두 불러 두고 화면만 갈아끼웁니다 — 탭마다 훅을 조건부로 부르면
     리액트 훅 규칙에 걸립니다. */
  const tickets = useAdminUserTickets(userId);
  const photocards = useAdminUserPhotocards(userId);
  const purchases = useAdminUserPurchases(userId);
  const sales = useAdminUserSales(userId);

  const backToList = () => navigate(ROUTES.ADMIN_USERS);

  if (!Number.isInteger(userId) || userId <= 0) {
    return (
      <EmptyState
        title="올바르지 않은 회원 주소예요"
        action={<Button onClick={backToList}>목록으로</Button>}
      />
    );
  }

  if (m.user.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (m.user.isError || !m.user.data) {
    return (
      <EmptyState
        title="회원을 불러오지 못했어요"
        description="탈퇴했거나 없는 회원입니다."
        action={<Button onClick={backToList}>목록으로</Button>}
      />
    );
  }

  const user = m.user.data;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={15} />} onClick={backToList}>
          회원 관리
        </Button>
      </div>

      <AdminUserProfileCard
        user={user}
        isSelf={m.isSelf}
        hasWallet={m.hasWallet}
        onAdjustCatMoney={m.openCatMoney}
        onDeleteFace={m.askDeleteFace}
        onWithdraw={m.askWithdraw}
      />

      <Card padded={false} className="overflow-hidden">
        <div className="border-line border-b p-3">
          <Segmented
            options={USER_DETAIL_TABS}
            value={m.tab}
            onChange={m.setTab}
            className="w-96"
          />
        </div>

        {m.tab === 'TICKETS' && (
          <AdminUserTicketTable tickets={tickets.data ?? []} isLoading={tickets.isPending} />
        )}

        {m.tab === 'PHOTOCARDS' && (
          <AdminUserPhotocardTable
            photocards={photocards.items}
            isLoading={photocards.isPending}
            hasMore={photocards.hasNextPage}
            isLoadingMore={photocards.isFetchingNextPage}
            onMore={() => void photocards.fetchNextPage()}
          />
        )}

        {m.tab === 'TRADES' && (
          <div className="p-3">
            <AdminUserTradeTables
              purchases={{
                items: purchases.items,
                isLoading: purchases.isPending,
                hasMore: purchases.hasNextPage,
                isLoadingMore: purchases.isFetchingNextPage,
                onMore: () => void purchases.fetchNextPage(),
              }}
              sales={{
                items: sales.items,
                isLoading: sales.isPending,
                hasMore: sales.hasNextPage,
                isLoadingMore: sales.isFetchingNextPage,
                onMore: () => void sales.fetchNextPage(),
              }}
            />
          </div>
        )}
      </Card>

      <AdminCatMoneyModal user={m.adjustingCatMoney ? user : null} onClose={m.closeCatMoney} />

      {/* 되돌릴 수 없는 동작은 확인 모달 + danger (CLAUDE.md 4-7) */}
      {m.confirming && (
        <ConfirmModal
          danger
          title={m.confirming === 'face' ? '얼굴 정보를 삭제할까요?' : '회원을 탈퇴 처리할까요?'}
          message={
            m.confirming === 'face'
              ? `${user.nickname}님의 얼굴 정보를 지웁니다. 재등록은 본인만 할 수 있고, 등록 전까지 티켓을 사용할 수 없어요.`
              : `${user.nickname}님(${user.email})을 탈퇴 처리합니다. 얼굴 정보가 즉시 파기되고 모든 기기에서 로그아웃됩니다. 되돌릴 수 없어요.`
          }
          confirmText={m.confirming === 'face' ? '삭제' : '탈퇴 처리'}
          onConfirm={m.confirm}
          onClose={m.closeConfirm}
        />
      )}
    </div>
  );
}
