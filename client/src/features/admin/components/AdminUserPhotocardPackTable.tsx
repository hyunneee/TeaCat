import { Badge, Button } from '@/shared/components/ui';
import { formatDateTime } from '@/shared/lib';
import type { AdminPhotocardPack, AdminPhotocardPackStatus } from '../model/adminPhotocardPack.types';
import { AdminRecordTable } from './AdminRecordTable';

interface Props {
  packs: AdminPhotocardPack[];
  isLoading: boolean;
  onInvalidate: (pack: AdminPhotocardPack) => void;
}

const HEADERS = ['팩', '개봉 상태', '처리 시각', '무효화 사유', '관리'] as const;

const STATUS_LABEL: Record<AdminPhotocardPackStatus, string> = {
  OPENABLE: '개봉 가능',
  SCHEDULED: '개봉 예정',
  PREPARING: '카드 준비 중',
  CONSUMED: '개봉 완료',
  INVALIDATED: '무효화',
};

const sourceLabel = (source: string) => {
  if (source === 'EVENT') return '이벤트';
  if (source === 'TICKET_PURCHASE') return '예매';
  if (source === 'TICKET_ENTRY') return '입장';
  return source;
};

const canInvalidate = (status: AdminPhotocardPackStatus) =>
  status === 'OPENABLE' || status === 'SCHEDULED' || status === 'PREPARING';

export function AdminUserPhotocardPackTable({ packs, isLoading, onInvalidate }: Props) {
  return (
    <AdminRecordTable
      headers={HEADERS}
      isLoading={isLoading}
      isEmpty={packs.length === 0}
      emptyTitle="지급된 카드팩이 없어요"
      emptyDescription="소비하거나 무효화한 카드팩도 이력으로 남아 여기에 표시됩니다."
    >
      {packs.map((pack) => (
        <tr key={pack.packId} className="border-line/60 hover:bg-surface-2 border-b last:border-0">
          <td className="px-4 py-3">
            <p className="text-ink font-medium">{pack.title ?? '카드팩'}</p>
            <p className="text-ink-muted text-xs">
              #{pack.packId} · {sourceLabel(pack.source)}
            </p>
          </td>
          <td className="px-4 py-3">
            <Badge tone={pack.status === 'INVALIDATED' ? 'danger' : 'quiet'}>
              {STATUS_LABEL[pack.status]}
            </Badge>
          </td>
          <td className="text-ink-muted px-4 py-3 text-xs tabular-nums">
            {pack.invalidatedAt
              ? formatDateTime(pack.invalidatedAt)
              : pack.consumedAt
                ? formatDateTime(pack.consumedAt)
                : pack.openAt
                  ? formatDateTime(pack.openAt)
                  : '즉시'}
          </td>
          <td className="text-ink-muted max-w-64 px-4 py-3 text-xs break-words">
            {pack.invalidatedReason ?? '—'}
          </td>
          <td className="px-4 py-3">
            {canInvalidate(pack.status) ? (
              <Button variant="danger" size="sm" onClick={() => onInvalidate(pack)}>
                무효화
              </Button>
            ) : (
              <span className="text-ink-subtle text-xs">—</span>
            )}
          </td>
        </tr>
      ))}
    </AdminRecordTable>
  );
}
