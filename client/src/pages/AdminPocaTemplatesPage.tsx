import { useState } from 'react';
import { EyeOff, Plus } from 'lucide-react';
import { Badge, Button, Card, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { useModal } from '@/app/providers';
import {
  AdminPocaTemplateFormModal,
  useAdminPocaTemplates,
  useCreatePocaTemplate,
  useSetTemplateHidden,
} from '@/features/admin';

/**
 * 카드 그림(템플릿) 관리.
 *
 * 여기서는 **그림만** 등록합니다. 몇 장 풀지는 공연·이벤트 풀에 넣을 때 정합니다 —
 * 같은 그림이라도 공연마다 다른 온체인 카드가 되기 때문입니다.
 *
 * 페이지는 조립만 합니다 (CLAUDE.md 3-6). 접근 제어는 라우터의 `RequireRole(['ADMIN'])`.
 */
export function AdminPocaTemplatesPage() {
  const { data: templates, isPending } = useAdminPocaTemplates();
  const create = useCreatePocaTemplate();
  const hide = useSetTemplateHidden();
  const { open } = useModal();

  const [adding, setAdding] = useState(false);

  /* 🔴 삭제가 아니라 감추기입니다 — 이미 만든 도안이 같은 그림을 가리켜서, 지우면 그 카드들이 깨집니다 */
  const askToHide = (templateId: number, name: string, usedCount: number) =>
    open('common/confirm', {
      title: `'${name}' 을 목록에서 감출까요?`,
      message:
        usedCount > 0
          ? `이미 ${usedCount}곳에 쓰였습니다. 감춰도 그 카드들은 그대로 동작하고, 앞으로 새로 고를 수만 없게 됩니다.`
          : '앞으로 풀에 넣을 때 목록에 나오지 않습니다.',
      confirmText: '감추기',
      onConfirm: () => hide.mutate({ templateId, hidden: true }),
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-ink text-lg font-bold">카드 그림 관리</h1>
          <p className="text-ink-muted text-sm">
            뽑기에 쓸 그림입니다. 올리면 서버가 IPFS 에 한 번 핀하고, 공연·이벤트 풀에 넣을 때
            그림을 다시 올리지 않고 재사용합니다.
          </p>
        </div>
        <Button variant="dark" leftIcon={<Plus size={16} />} onClick={() => setAdding(true)}>
          그림 등록
        </Button>
      </div>

      {isPending ? (
        <div className="grid grid-cols-4 gap-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : !templates || templates.length === 0 ? (
        <EmptyState
          title="등록된 카드 그림이 없어요"
          description="그림을 올려야 공연이나 이벤트 뽑기 풀에 카드를 넣을 수 있습니다."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
          {templates.map((template) => (
            <li key={template.templateId}>
              <Card className="flex h-full flex-col gap-2 p-3">
                <img
                  src={template.imageUrl}
                  alt=""
                  className="bg-surface-2 aspect-[2/3] w-full rounded-lg object-cover"
                />

                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate font-semibold">{template.name}</p>
                  <p className="text-ink-muted truncate text-sm">{template.group}</p>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Badge tone={template.grade === 'COMMON' ? 'quiet' : 'accent'} size="sm">
                    {template.grade === 'COMMON' ? '보라' : '금색'}
                  </Badge>
                  <span className="text-ink-subtle text-xs">{template.usedCount}곳에 사용</span>
                </div>

                {/* 🔴 삭제 버튼은 만들지 않습니다 — 삭제 API 가 없고, 지우면 이 그림을 쓰는
                    모든 도안의 이미지가 깨집니다 */}
                <Button
                  variant="soft"
                  size="sm"
                  fullWidth
                  leftIcon={<EyeOff size={14} />}
                  onClick={() => askToHide(template.templateId, template.name, template.usedCount)}
                >
                  목록에서 감추기
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AdminPocaTemplateFormModal
        open={adding}
        onClose={() => setAdding(false)}
        isPending={create.isPending}
        onSubmit={(body) => create.mutate(body, { onSuccess: () => setAdding(false) })}
      />
    </div>
  );
}
