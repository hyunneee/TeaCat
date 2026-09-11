import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import {
  AdminPocaDesignFormModal,
  useAdminDrawPoolDesigns,
  useCreatePocaDesign,
  useRetryDesignRegistration,
  type PocaDesignChainStatus,
} from '@/features/admin';

/** 온체인 등록 상태를 한 눈에 — 색은 상태 칩 규칙을 따릅니다 (DESIGN.md 1장) */
const CHAIN: Record<
  PocaDesignChainStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' }
> = {
  REGISTERED: { label: '등록 완료', tone: 'success' },
  REGISTERING: { label: '확정 대기', tone: 'warning' },
  PENDING: { label: '등록 안 됨', tone: 'warning' },
  FAILED: { label: '등록 실패', tone: 'danger' },
};

/**
 * 뽑기 도안 관리.
 *
 * 여기 등록한 도안만 카드팩에서 나옵니다. 도안이 하나도 없으면 뽑기가 `NFT_041` 로 거절됩니다.
 *
 * 페이지는 조립만 합니다 — 훅을 불러 컴포넌트에 내려줍니다 (CLAUDE.md 3-6).
 * 접근 제어는 라우터의 `RequireRole(['ADMIN'])` 이 이미 끝냈습니다.
 */
export function AdminPocaDesignsPage() {
  const { data: designs, isPending } = useAdminDrawPoolDesigns();
  const create = useCreatePocaDesign();
  const retry = useRetryDesignRegistration();

  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-ink text-lg font-bold">뽑기 도안 관리</h1>
          <p className="text-ink-muted text-sm">
            카드팩에서 나올 도안입니다. 그림을 올리면 서버가 IPFS 에 핀하고 온체인에 등록합니다.
            한정 수량이 소진된 도안은 뽑기 풀에서 빠집니다.
          </p>
        </div>
        <Button variant="dark" leftIcon={<Plus size={16} />} onClick={() => setAdding(true)}>
          도안 등록
        </Button>
      </div>

      {isPending ? (
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : !designs || designs.length === 0 ? (
        <EmptyState
          title="등록된 뽑기 도안이 없어요"
          description="도안을 하나도 등록하지 않으면 카드팩을 열어도 뽑을 카드가 없습니다."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-line text-ink-muted border-b text-left">
              <tr>
                <th className="p-3 font-medium">그림</th>
                <th className="p-3 font-medium">이름</th>
                <th className="p-3 font-medium">소속</th>
                <th className="p-3 font-medium">등급</th>
                <th className="p-3 font-medium">발급 / 한정</th>
                <th className="p-3 font-medium">온체인</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {designs.map((design) => (
                <tr key={design.designId} className="border-line/70 border-b last:border-0">
                  <td className="p-3">
                    {design.imageUrl ? (
                      <img
                        src={design.imageUrl}
                        alt=""
                        className="h-16 w-11 rounded-md object-cover"
                      />
                    ) : (
                      <span className="surface-2 block h-16 w-11 rounded-md" />
                    )}
                  </td>
                  <td className="p-3 font-semibold">{design.name}</td>
                  <td className="p-3">{design.group ?? '—'}</td>
                  <td className="p-3">
                    {design.grade === 'COMMON' ? '보라 (개발자)' : '금색 (코치·교육생)'}
                  </td>
                  <td className="p-3 tabular-nums">
                    {design.issuedCount} / {design.totalSupply}
                  </td>
                  <td className="p-3">
                    <Badge tone={CHAIN[design.chainStatus].tone} size="sm">
                      {CHAIN[design.chainStatus].label}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    {/* 등록이 안 끝난 도안만 — 그림을 다시 올리지 않고 등록만 다시 보냅니다 */}
                    {design.chainStatus !== 'REGISTERED' && (
                      <Button
                        variant="soft"
                        size="sm"
                        leftIcon={<RefreshCw size={14} />}
                        loading={retry.isPending}
                        onClick={() => retry.mutate({ designId: design.designId })}
                      >
                        다시 등록
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <AdminPocaDesignFormModal
        open={adding}
        onClose={() => setAdding(false)}
        isPending={create.isPending}
        onSubmit={(body) => create.mutate(body, { onSuccess: () => setAdding(false) })}
      />
    </div>
  );
}
