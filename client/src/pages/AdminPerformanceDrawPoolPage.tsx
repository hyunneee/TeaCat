import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { Button, Card, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useModal } from '@/app/providers';
import { useMyConcert } from '@/features/organizer';
import {
  AdminPocaDesignTable,
  AdminPocaPoolPicker,
  useAddPerformanceDesigns,
  useAdminPocaTemplates,
  usePerformanceDrawPool,
  useRetryDesignRegistration,
  useSetDesignDrawPool,
  notYetDrawable,
  type PocaPoolItem,
} from '@/features/admin';

/**
 * 공연별 뽑기 풀 — **이 공연 카드팩에서 나올 카드**를 정합니다.
 *
 * 🔴 여기에 카드를 넣지 않으면 그 공연 팩은 열어도 `NFT_041` 로 실패합니다.
 *
 * 페이지는 조립만 합니다 (CLAUDE.md 3-6). 접근 제어는 라우터의 `RequireRole(['ADMIN'])`.
 */
export function AdminPerformanceDrawPoolPage() {
  const { concertId = '' } = useParams();
  const performanceId = Number(concertId);

  const { data: concert } = useMyConcert(concertId);
  const { data: pool, isPending } = usePerformanceDrawPool(performanceId);
  const { data: templates } = useAdminPocaTemplates();

  const add = useAddPerformanceDesigns(performanceId);
  const retry = useRetryDesignRegistration();
  const exclude = useSetDesignDrawPool();
  const { open } = useModal();

  /* 🔴 되돌릴 수 없는 동작입니다 — 수량이 온체인 maxSupply 로 박히고, 첫 장이 나가면
     올리지도 내리지도 못합니다. 소각 함수가 없어 잘못 나간 카드는 회수도 안 됩니다. */
  const confirmAdd = (items: PocaPoolItem[], summary: string) => {
    const total = items.reduce((sum, item) => sum + item.totalSupply, 0);
    const short = pool ? Math.max(0, pool.seatCapacity - (pool.poolRemaining + total)) : 0;

    open('common/confirm', {
      title: '이 내용으로 공연에 넣을까요?',
      message:
        `${summary} (총 ${items.length}종 ${total.toLocaleString()}장)\n\n` +
        `수량은 온체인에 박히고 첫 장이 발급되면 바꿀 수 없습니다.` +
        (short > 0 ? `\n⚠️ 전 회차 좌석보다 ${short.toLocaleString()}장 부족합니다.` : ''),
      confirmText: '넣기',
      onConfirm: () => add.mutate(items),
    });
  };

  const unregistered = pool ? notYetDrawable(pool.designs) : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          to={ROUTES.ADMIN_CONCERT_EDIT(concertId)}
          className="text-ink-muted hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft size={14} /> 공연 관리로
        </Link>
        <h1 className="text-ink mt-1 text-lg font-bold">
          뽑기 카드 {concert ? `— ${concert.title}` : ''}
        </h1>
        <p className="text-ink-muted text-sm">
          이 공연 카드팩에서 나올 카드입니다. 하나도 넣지 않으면 관객이 팩을 열어도 카드를 받지
          못합니다.
        </p>
      </div>

      {isPending ? (
        <Skeleton className="h-40" />
      ) : !pool ? (
        <EmptyState icon={TriangleAlert} title="공연을 찾지 못했어요" />
      ) : (
        <>
          {/* 수량은 공연 단위인데 관객은 회차마다 있습니다 — 그래서 좌석 합계와 나란히 봅니다 */}
          <Card className="flex flex-wrap items-center gap-x-8 gap-y-2 p-4">
            <div>
              <p className="text-ink-muted text-sm">전 회차 좌석</p>
              <p className="text-ink text-lg font-bold tabular-nums">
                {pool.seatCapacity.toLocaleString()}석
              </p>
            </div>
            <div>
              <p className="text-ink-muted text-sm">등록된 카드(남은 수)</p>
              <p className="text-ink text-lg font-bold tabular-nums">
                {pool.poolRemaining.toLocaleString()}장
              </p>
            </div>

            {!pool.sufficient && (
              <p className="text-danger flex items-center gap-2 text-sm">
                <TriangleAlert size={16} />
                카드가 모자랍니다 — 뒤 회차 관객이 카드를 받지 못할 수 있습니다.
              </p>
            )}

            {unregistered.length > 0 && (
              /* 잔여 합계는 등록 상태를 보지 않습니다 — 미등록이 섞이면 "충분함" 이 낙관적입니다 */
              <p className="text-ink-muted text-sm">
                이 중 {unregistered.length}종은 아직 온체인 등록이 끝나지 않아 뽑히지 않습니다.
              </p>
            )}
          </Card>

          <Card className="space-y-3 p-4">
            <p className="text-ink font-semibold">카드 넣기</p>
            <AdminPocaPoolPicker
              templates={templates ?? []}
              addedTemplateIds={pool.designs
                .map((d) => d.templateId)
                .filter((id): id is number => id !== null)}
              performanceTitle={concert?.title}
              /* 좌석을 채우고도 남은 만큼만 권합니다 — 이미 넣은 카드까지 다시 찍으면 낭비입니다 */
              suggestTotal={Math.max(0, pool.seatCapacity - pool.poolRemaining)}
              isPending={add.isPending}
              onSubmit={confirmAdd}
            />
          </Card>

          {pool.designs.length === 0 ? (
            <EmptyState
              title="이 공연에 넣은 카드가 없어요"
              description="카드를 넣지 않으면 관객이 카드팩을 열어도 NFT_041 로 실패합니다."
            />
          ) : (
            <AdminPocaDesignTable
              designs={pool.designs}
              isPending={retry.isPending || exclude.isPending}
              onRetry={(designId) => retry.mutate({ designId })}
              onExclude={(designId) =>
                open('common/confirm', {
                  title: '이 카드를 뽑기에서 뺄까요?',
                  message:
                    '앞으로 이 공연 카드팩에서 나오지 않습니다. 이미 발행된 카드는 그대로 남고, 온체인 등록도 되돌아가지 않습니다.',
                  confirmText: '제외',
                  onConfirm: () => exclude.mutate({ designId, drawPool: false }),
                })
              }
            />
          )}
        </>
      )}

      <div>
        <Button variant="soft" onClick={() => window.history.back()}>
          뒤로
        </Button>
      </div>
    </div>
  );
}
