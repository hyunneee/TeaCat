import { Card, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { useModal } from '@/app/providers';
import {
  AdminPocaDesignTable,
  AdminPocaPoolPicker,
  useAddEventPoolDesigns,
  useAdminEventPoolDesigns,
  useAdminPocaTemplates,
  useRetryDesignRegistration,
  notYetDrawable,
} from '@/features/admin';

/**
 * 이벤트 뽑기 풀 — **공연과 무관하게** 이벤트 카드팩에서 나올 카드입니다.
 *
 * 🔴 이벤트 풀은 **하나를 공유**합니다. 이벤트를 여러 개 열어도 같은 카드에서 뽑히므로
 * "이벤트별 카드 세트" 를 약속하지 마세요.
 *
 * 공연 관람으로 받은 팩은 그 공연 풀에서 뽑힙니다 — 공연 관리 > 뽑기 카드 에서 정합니다.
 *
 * 페이지는 조립만 합니다 (CLAUDE.md 3-6). 접근 제어는 라우터의 `RequireRole(['ADMIN'])`.
 */
export function AdminPocaDesignsPage() {
  const { data: designs, isPending } = useAdminEventPoolDesigns();
  const { data: templates } = useAdminPocaTemplates();

  const add = useAddEventPoolDesigns();
  const { open } = useModal();
  const retry = useRetryDesignRegistration();

  const unregistered = designs ? notYetDrawable(designs) : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-ink text-lg font-bold">이벤트 뽑기 풀</h1>
        <p className="text-ink-muted text-sm">
          이벤트 카드팩에서 나올 카드입니다. 이벤트를 여러 개 열어도 <b>같은 풀</b>에서 뽑힙니다.
          공연 관람으로 받은 팩은 그 공연의 풀에서 뽑힙니다.
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <p className="text-ink font-semibold">카드 넣기</p>
        {/* 🔴 이벤트 풀 도안은 나중에 뽑기에서 뺄 수 없습니다(409). 넣기 전에 확인합니다 */}
        <AdminPocaPoolPicker
          templates={templates ?? []}
          addedTemplateIds={(designs ?? [])
            .map((d) => d.templateId)
            .filter((id): id is number => id !== null)}
          isPending={add.isPending}
          onSubmit={(items, summary) => {
            const total = items.reduce((sum, item) => sum + item.totalSupply, 0);

            open('common/confirm', {
              title: '이 내용으로 이벤트 풀에 넣을까요?',
              message:
                `${summary} (총 ${items.length}종 ${total.toLocaleString()}장)

` +
                '수량은 온체인에 박히고 첫 장이 발급되면 바꿀 수 없습니다. 이벤트 풀 카드는 나중에 뽑기에서 뺄 수도 없습니다.',
              confirmText: '넣기',
              onConfirm: () => add.mutate(items),
            });
          }}
        />
      </Card>

      {unregistered.length > 0 && (
        <p className="text-ink-muted text-sm">
          {unregistered.length}종은 아직 온체인 등록이 끝나지 않아 뽑히지 않습니다.
        </p>
      )}

      {isPending ? (
        <Skeleton className="h-40" />
      ) : !designs || designs.length === 0 ? (
        <EmptyState
          title="이벤트 풀에 카드가 없어요"
          description="카드를 넣지 않으면 이벤트 카드팩을 열어도 뽑을 카드가 없습니다."
        />
      ) : (
        /* 이벤트 풀 도안은 뽑기에서 뺄 수 없어(NFT_048) 제외 버튼을 주지 않습니다 */
        <AdminPocaDesignTable
          designs={designs}
          isPending={retry.isPending}
          onRetry={(designId) => retry.mutate({ designId })}
        />
      )}
    </div>
  );
}
