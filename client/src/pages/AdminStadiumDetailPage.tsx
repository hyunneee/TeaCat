import { ArrowLeft, CopyPlus, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, ConfirmModal, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import {
  StadiumLayoutEditModal,
  StadiumLayoutPreview,
  STADIUM_LAYOUT_STATUS_LABEL,
  useStadiumDetailManagement,
  useStadiumLayoutPreview,
} from '@/features/stadium';

export function AdminStadiumDetailPage() {
  const navigate = useNavigate();
  const { stadiumId: stadiumIdParam } = useParams();
  const stadiumId = Number(stadiumIdParam);
  const management = useStadiumDetailManagement(stadiumId);
  const selectedLayout = management.selectedLayout;
  const preview = useStadiumLayoutPreview(selectedLayout?.layoutId ?? null);

  if (!Number.isInteger(stadiumId) || stadiumId <= 0) {
    return (
      <EmptyState
        title="올바르지 않은 공연장 주소예요"
        action={<Button onClick={() => navigate(ROUTES.ADMIN_STADIUMS)}>목록으로</Button>}
      />
    );
  }

  if (management.stadium.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[36rem] w-full" />
      </div>
    );
  }

  if (!management.stadium.data || management.stadium.isError) {
    return (
      <EmptyState
        title="공연장을 불러오지 못했어요"
        description="삭제되었거나 접근할 수 없는 공연장입니다."
        action={<Button onClick={() => navigate(ROUTES.ADMIN_STADIUMS)}>목록으로</Button>}
      />
    );
  }

  const stadium = management.stadium.data;

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-3"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => navigate(ROUTES.ADMIN_STADIUMS)}
          >
            공연장 목록
          </Button>
          <h1 className="text-ink truncate text-xl font-bold">{stadium.name}</h1>
          <p className="text-ink-muted mt-1 text-sm">{stadium.address}</p>
          <p className="text-ink-subtle mt-0.5 text-xs">
            {stadium.phone ?? '전화번호 없음'} · 구역 {stadium.areaCount}개 · 최대 수용 인원{' '}
            {stadium.maxCapacity.toLocaleString()}명
          </p>
        </div>
        <Button
          variant="dark"
          size="sm"
          leftIcon={<Plus size={16} />}
          onClick={() => navigate(`${ROUTES.ADMIN_STADIUM}?stadiumId=${stadiumId}`)}
        >
          새 배치 등록
        </Button>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="self-start" padded={false}>
          <div className="border-line flex items-start justify-between gap-2 border-b px-4 py-3">
            <div>
              <h2 className="text-ink font-bold">저장된 배치</h2>
              <p className="text-ink-muted text-xs">
                기본 배치를 포함해 {management.layouts.data?.layouts.length ?? 0}개
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              loading={management.layouts.isFetching}
              onClick={() => void management.layouts.refetch()}
              aria-label="저장된 배치 새로고침"
            >
              새로고침
            </Button>
          </div>

          {management.layouts.isPending ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          ) : management.layouts.data?.layouts.length ? (
            <ul className="divide-line/60 divide-y">
              {management.layouts.data.layouts.map((layout) => {
                const active = selectedLayout?.layoutId === layout.layoutId;
                return (
                  <li key={layout.layoutId}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={
                        'w-full px-4 py-3 text-left transition-colors ' +
                        (active ? 'bg-surface-2' : 'hover:bg-surface-2/70')
                      }
                      onClick={() => management.selectLayout(layout.layoutId)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        management.selectLayout(layout.layoutId);
                      }}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="text-ink block truncate text-sm font-semibold">
                            {layout.name}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            {layout.isDefault && <Badge tone="accent">기본 배치</Badge>}
                            <Badge tone="quiet">{STADIUM_LAYOUT_STATUS_LABEL[layout.status]}</Badge>
                          </span>
                        </span>
                        <span className="text-ink-muted shrink-0 text-xs">
                          합계 {layout.capacity.toLocaleString()}명
                        </span>
                      </span>
                      <span className="text-ink-muted mt-1 block text-xs">
                        좌석 {layout.seatCount.toLocaleString()}석 · 스탠딩{' '}
                        {layout.standingCapacity.toLocaleString()}명
                      </span>
                      <span className="mt-3 flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Pencil size={14} />}
                          onClick={(event) => {
                            event.stopPropagation();
                            management.openLayoutEdit(layout);
                          }}
                        >
                          정보 수정
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<CopyPlus size={14} />}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(
                              `${ROUTES.ADMIN_STADIUM}?stadiumId=${stadiumId}&sourceLayoutId=${layout.layoutId}`,
                            );
                          }}
                        >
                          복제·수정
                        </Button>
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          leftIcon={<Trash2 size={14} />}
                          disabled={layout.isDefault}
                          title={layout.isDefault ? '기본 배치는 삭제할 수 없습니다.' : undefined}
                          onClick={(event) => {
                            event.stopPropagation();
                            management.openLayoutDelete(layout);
                          }}
                        >
                          삭제
                        </Button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="저장된 배치가 없어요"
              description="새 배치를 등록해 좌석표를 만들어 주세요."
              className="min-h-72"
            />
          )}
        </Card>

        {preview.isError ? (
          <Card>
            <EmptyState
              title="좌석 배치표를 불러오지 못했어요"
              description="잠시 후 배치를 다시 선택해 주세요."
              className="min-h-[32rem]"
            />
          </Card>
        ) : (
          <StadiumLayoutPreview
            key={selectedLayout?.layoutId ?? 'empty'}
            name={selectedLayout?.name}
            width={preview.data?.width}
            height={preview.data?.height}
            areas={preview.data?.areas}
            layoutElements={preview.data?.layoutElements}
            isLoading={preview.isPending && selectedLayout !== null}
          />
        )}
      </div>

      <StadiumLayoutEditModal
        layout={management.editingLayout}
        isPending={management.updateLayout.isPending}
        onClose={management.closeLayoutEdit}
        onSubmit={(layoutId, body) => management.updateLayout.mutate({ layoutId, body })}
      />

      {management.deletingLayout && (
        <ConfirmModal
          danger
          title="배치를 삭제할까요?"
          message={`${management.deletingLayout.name}의 모든 구역과 좌석을 삭제합니다. 공연에 사용 중인 배치는 삭제할 수 없습니다.`}
          confirmText="배치 삭제"
          onConfirm={() => management.deleteLayout.mutate(management.deletingLayout!.layoutId)}
          onClose={management.closeLayoutDelete}
        />
      )}
    </div>
  );
}
