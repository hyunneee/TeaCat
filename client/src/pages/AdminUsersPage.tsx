import { Card } from '@/shared/components/ui';
import {
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
          onOpen={m.openDetail}
          onEdit={m.openEdit}
          onResetPassword={m.openResetPassword}
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

      {/* 🔴 캣머니 조정·얼굴 삭제·탈퇴 확인 모달은 여기 없습니다 —
          회원 상세(AdminUserDetailPage)로 옮겼습니다 */}
    </div>
  );
}
