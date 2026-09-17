import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, ConfirmModal, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { objectPositionOf } from '@/features/banner';
import {
  AdminBannerFormModal,
  useAdminBanners,
  useCreateBanner,
  useDeleteBanner,
  useReorderBanners,
  useUpdateBanner,
  useUploadBannerImage,
  type AdminBanner,
} from '@/features/admin';

/**
 * 메인 배너 관리.
 *
 * 페이지는 조립만 합니다 — 훅을 불러 컴포넌트에 내려줍니다 (CLAUDE.md 3-6).
 * 접근 제어는 라우터의 `RequireRole(['ADMIN'])` 이 이미 끝냈습니다.
 */
export function AdminBannersPage() {
  const { data: banners, isPending } = useAdminBanners();

  const create = useCreateBanner();
  const update = useUpdateBanner();
  const remove = useDeleteBanner();
  const reorder = useReorderBanners();
  const upload = useUploadBannerImage();

  /** null = 닫힘, 'new' = 등록, 객체 = 수정 */
  const [editing, setEditing] = useState<AdminBanner | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminBanner | null>(null);

  /** 위·아래 한 칸 이동. 서버는 전체 순서를 받으므로 새 배열을 만들어 보냅니다 */
  const move = (index: number, direction: -1 | 1) => {
    if (!banners) return;

    const next = [...banners];
    const target = next[index + direction];
    if (!target) return;

    next[index + direction] = next[index] as AdminBanner;
    next[index] = target;

    reorder.mutate(next.map((banner) => banner.bannerId));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-ink">메인 배너 관리</h1>
          <p className="text-sm text-ink-muted">
            홈 상단 슬라이드입니다. 위에 있는 것부터 순서대로 보이고, 노출을 끄면 홈에서 사라집니다.
          </p>
        </div>
        <Button variant="dark" leftIcon={<Plus size={16} />} onClick={() => setEditing('new')}>
          배너 등록
        </Button>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !banners || banners.length === 0 ? (
        <Card>
          <EmptyState
            title="등록된 배너가 없어요"
            description="이미지를 올리거나 공연을 지정해 첫 슬라이드를 만들어 보세요."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {banners.map((banner, index) => (
            <li key={banner.bannerId}>
              <Card className="flex items-center gap-4">
                {/* 순서 — 위/아래 한 칸씩. 첫 줄의 위, 마지막 줄의 아래는 눌리지 않습니다 */}
                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="위로"
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="아래로"
                    disabled={index === banners.length - 1 || reorder.isPending}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={15} />
                  </Button>
                </div>

                {banner.imageUrl ? (
                  /* 홈과 **같은 부분**을 보여줍니다. 목록만 가운데로 자르면 골라 둔
                     크롭이 맞는지 여기서는 확인할 수 없습니다 */
                  <img
                    src={banner.imageUrl}
                    alt=""
                    style={{ objectPosition: objectPositionOf(banner.imageFocus) }}
                    className="h-16 w-24 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="surface-2 flex h-16 w-24 shrink-0 items-center justify-center rounded-lg text-xs text-ink-subtle">
                    이미지 없음
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={banner.active ? 'accent' : 'quiet'}>
                      {banner.active ? '노출 중' : '숨김'}
                    </Badge>
                    <Badge tone="quiet">
                      {banner.type === 'IMAGE' ? '이미지' : '공연'}
                    </Badge>
                    {banner.label && <span className="text-xs text-ink-muted">{banner.label}</span>}
                  </div>
                  <p className="mt-1 truncate font-medium text-ink">{banner.title}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {banner.type === 'PERFORMANCE'
                      ? `공연 · ${banner.performanceTitle ?? '알 수 없음'}`
                      : (banner.linkPath ?? '이동 없음')}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Pencil size={15} />}
                    onClick={() => setEditing(banner)}
                  >
                    수정
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      update.mutate({
                        bannerId: banner.bannerId,
                        body: {
                          type: banner.type,
                          title: banner.title,
                          subtitle: banner.subtitle,
                          label: banner.label,
                          imageKey: banner.imageKey,
                          /* 🔴 노출만 끄고 켜는 자리지만 **전체를 다시 보내는 API** 라,
                             빠뜨리면 골라 둔 크롭 위치가 가운데로 되돌아갑니다 */
                          imageFocus: banner.imageFocus,
                          performanceId: banner.performanceId,
                          linkPath: banner.linkPath,
                          active: !banner.active,
                        },
                      })
                    }
                  >
                    {banner.active ? '숨기기' : '노출'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 size={15} />}
                    onClick={() => setDeleting(banner)}
                  >
                    삭제
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing !== null && (
        <AdminBannerFormModal
          banner={editing === 'new' ? null : editing}
          saving={create.isPending || update.isPending}
          uploading={upload.isPending}
          onClose={() => setEditing(null)}
          onUpload={(file) => upload.mutateAsync(file)}
          onSubmit={(body) => {
            if (editing === 'new') {
              create.mutate(body, { onSuccess: () => setEditing(null) });
            } else {
              update.mutate(
                { bannerId: editing.bannerId, body },
                { onSuccess: () => setEditing(null) },
              );
            }
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          danger
          title="배너를 삭제할까요?"
          message="되돌릴 수 없습니다. 올린 이미지도 함께 지워집니다."
          confirmText="삭제"
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            remove.mutate(deleting.bannerId);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
