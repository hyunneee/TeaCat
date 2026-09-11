import { useNavigate } from 'react-router-dom';
import { Card, ConfirmModal } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import {
  AdminStadiumTable,
  AdminStadiumToolbar,
  StadiumEditModal,
  useStadiumListManagement,
} from '@/features/stadium';

export function AdminStadiumListPage() {
  const navigate = useNavigate();
  const management = useStadiumListManagement();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-ink text-lg font-bold">공연장 목록</h1>
        <p className="text-ink-muted text-sm">
          등록된 공연장을 조회하고 기본 정보와 좌석 배치를 관리합니다.
        </p>
      </div>

      <Card padded={false} className="overflow-hidden">
        <AdminStadiumToolbar
          keyword={management.keyword}
          onSearch={management.setKeyword}
          onCreate={() => navigate(ROUTES.ADMIN_STADIUM)}
        />
        <AdminStadiumTable
          stadiums={management.stadiums}
          isLoading={management.list.isPending}
          onOpen={(stadium) => navigate(ROUTES.ADMIN_STADIUM_DETAIL(String(stadium.stadiumId)))}
          onEdit={management.openEdit}
          onDelete={management.openDelete}
        />
        {!management.list.isPending && (
          <p className="border-line text-ink-muted border-t px-4 py-3 text-xs">
            전체 {management.list.data?.stadiums.length ?? 0}개
          </p>
        )}
      </Card>

      <StadiumEditModal
        stadium={management.editing}
        isPending={management.update.isPending}
        onClose={management.closeEdit}
        onSubmit={(stadiumId, body) => management.update.mutate({ stadiumId, body })}
      />

      {management.deleting && (
        <ConfirmModal
          danger
          title="공연장을 삭제할까요?"
          message={`${management.deleting.name}과 저장된 모든 배치·구역·좌석을 삭제합니다. 공연에 사용 중인 공연장은 삭제할 수 없습니다.`}
          confirmText="공연장 삭제"
          onConfirm={() => management.remove.mutate(management.deleting!.stadiumId)}
          onClose={management.closeDelete}
        />
      )}
    </div>
  );
}
