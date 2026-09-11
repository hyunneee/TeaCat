import { RefreshCw, SlashIcon } from 'lucide-react';
import { Badge, Button, Card } from '@/shared/components/ui';
import type { AdminPocaDesign, PocaDesignChainStatus } from '../model/adminPocaDesign.types';

/** 온체인 등록 상태 — 색은 상태 칩 규칙을 따릅니다 (DESIGN.md 1장) */
const CHAIN: Record<
  PocaDesignChainStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' }
> = {
  REGISTERED: { label: '뽑기 가능', tone: 'success' },
  REGISTERING: { label: '확정 대기', tone: 'warning' },
  PENDING: { label: '등록 안 됨', tone: 'warning' },
  FAILED: { label: '등록 실패', tone: 'danger' },
};

interface Props {
  designs: AdminPocaDesign[];
  isPending: boolean;
  onRetry: (designId: number) => void;
  /** 없으면 제외 버튼을 그리지 않습니다 (이벤트 풀 화면) */
  onExclude?: (designId: number) => void;
}

/**
 * 풀에 들어간 도안 표. 공연 풀과 이벤트 풀이 같이 씁니다.
 *
 * 🔴 **`REGISTERED` 가 아닌 도안은 아직 뽑히지 않습니다.** 서버의 잔여 합계는 등록 상태를
 * 보지 않으므로, 여기서 상태를 보여주지 않으면 "충분한데 왜 안 나오지" 가 됩니다.
 *
 * 서버를 모릅니다 — props 로 받은 것만 씁니다. (CLAUDE.md 4-3)
 */
export function AdminPocaDesignTable({ designs, isPending, onRetry, onExclude }: Props) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[48rem] text-sm">
        <thead className="border-line text-ink-muted border-b text-left">
          <tr>
            <th className="p-3 font-medium">그림</th>
            <th className="p-3 font-medium">이름</th>
            <th className="p-3 font-medium">소속</th>
            <th className="p-3 font-medium">남음 / 한정</th>
            <th className="p-3 font-medium">상태</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {designs.map((design) => (
            <tr key={design.designId} className="border-line/70 border-b last:border-0">
              <td className="p-3">
                {design.imageUrl ? (
                  <img src={design.imageUrl} alt="" className="h-16 w-11 rounded-md object-cover" />
                ) : (
                  <span className="surface-2 block h-16 w-11 rounded-md" />
                )}
              </td>
              <td className="p-3">
                <span className="font-semibold">{design.name}</span>
                {/* 뽑기에서 뺀 도안은 표에 남지만 더는 안 나옵니다 — 그 사실을 적어 줍니다 */}
                {!design.drawPool && (
                  <Badge tone="quiet" size="sm" className="ml-2">
                    제외됨
                  </Badge>
                )}
              </td>
              <td className="p-3">{design.group ?? '—'}</td>
              <td className="p-3 tabular-nums">
                {design.remaining} / {design.totalSupply}
              </td>
              <td className="p-3">
                <Badge tone={CHAIN[design.chainStatus].tone} size="sm">
                  {CHAIN[design.chainStatus].label}
                </Badge>
              </td>
              <td className="p-3">
                <div className="flex justify-end gap-2">
                  {/* 등록이 안 끝난 도안만 — 그림을 다시 올리지 않고 등록만 다시 보냅니다 */}
                  {design.chainStatus !== 'REGISTERED' && (
                    <Button
                      variant="soft"
                      size="sm"
                      leftIcon={<RefreshCw size={14} />}
                      loading={isPending}
                      onClick={() => onRetry(design.designId)}
                    >
                      다시 등록
                    </Button>
                  )}

                  {/* 🔴 "삭제" 가 아닙니다 — 발행된 카드도, 온체인 등록도 그대로입니다 */}
                  {onExclude && design.drawPool && (
                    <Button
                      variant="soft"
                      size="sm"
                      leftIcon={<SlashIcon size={14} />}
                      loading={isPending}
                      onClick={() => onExclude(design.designId)}
                    >
                      뽑기에서 제외
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
