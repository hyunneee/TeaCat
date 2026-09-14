import { Card, ConfirmModal } from '@/shared/components/ui';
import {
  AdminCatMoneyModal,
  AdminPagination,
  AdminPasswordResetModal,
  AdminUserCreateModal,
  AdminUserEditModal,
  AdminUserTable,
  AdminUserToolbar,
  useAdminUserManagement,
} from '@/features/admin';

/**
 * 유저 관리.
 *
 * 페이지는 조립만 합니다 — 훅 하나를 불러 컴포넌트에 내려줍니다 (CLAUDE.md 3-6).
 * 접근 제어는 라우터의 `RequireRole(['ADMIN'])` 이 이미 끝냈습니다.
 */
export function AdminUsersPage() {
  const m = useAdminUserManagement();
  const page = m.list.data;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold text-ink">유저 관리</h1>
        <p className="text-sm text-ink-muted">
          모든 역할의 회원을 만들고 관리합니다. 본인 계정은 마이페이지에서 변경하세요.
        </p>
      </div>

      <Card padded={false} className="overflow-hidden">
        <AdminUserToolbar
          keyword={m.list.keyword}
          role={m.list.role}
          onSearch={m.list.search}
          onFilterRole={m.list.filterRole}
          onCreate={m.openCreate}
        />

        <AdminUserTable
          users={page?.users ?? []}
          isLoading={m.list.isPending}
          currentUserId={m.me?.userId}
          onEdit={m.openEdit}
          onResetPassword={m.openResetPassword}
          onDeleteFace={m.openDeleteFace}
          onWithdraw={m.openWithdraw}
          onAdjustCatMoney={m.openCatMoney}
        />

        <AdminPagination
          page={page?.page ?? 0}
          totalPages={page?.totalPages ?? 0}
          totalElements={page?.totalElements ?? 0}
          onChange={m.list.setPage}
        />
      </Card>

      <AdminUserCreateModal
        open={m.creating}
        onClose={m.closeCreate}
        onSubmit={m.create.mutate}
        isPending={m.create.isPending}
      />

      <AdminUserEditModal
        user={m.editing}
        onClose={m.closeEdit}
        onSubmit={(userId, body) => m.update.mutate({ userId, body })}
        isPending={m.update.isPending}
      />

      <AdminPasswordResetModal
        user={m.resetting}
        onClose={m.closeResetPassword}
        onSubmit={(userId, newPassword) => m.resetPassword.mutate({ userId, newPassword })}
        isPending={m.resetPassword.isPending}
      />

      {/* 테스트용 캣머니 조정 — 지갑이 있는 역할(USER)에만 버튼이 보입니다 */}
      <AdminCatMoneyModal user={m.adjustingCatMoney} onClose={m.closeCatMoney} />

      {/* 되돌릴 수 없는 동작은 확인 모달 + danger (CLAUDE.md 4-7) */}
      {m.confirming && (
        <ConfirmModal
          danger
          title={m.confirming.kind === 'face' ? '얼굴 정보를 삭제할까요?' : '회원을 탈퇴 처리할까요?'}
          message={
            m.confirming.kind === 'face'
              ? `${m.confirming.user.nickname}님의 얼굴 정보를 지웁니다. 재등록은 본인만 할 수 있고, 등록 전까지 티켓을 사용할 수 없어요.`
              : `${m.confirming.user.nickname}님(${m.confirming.user.email})을 탈퇴 처리합니다. 얼굴 정보가 즉시 파기되고 모든 기기에서 로그아웃됩니다. 되돌릴 수 없어요.`
          }
          confirmText={m.confirming.kind === 'face' ? '삭제' : '탈퇴 처리'}
          onConfirm={m.confirm}
          onClose={m.closeConfirm}
        />
      )}
    </div>
  );
}
