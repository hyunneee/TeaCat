import { Badge } from '@/shared/components/ui';
import { formatDateTime } from '@/shared/lib';
import { AdminRecordTable } from '@/features/admin';
import { seatText } from '../model/operations.model';
import type { OperationsAttendee } from '../model/operations.types';

interface Props {
  rows: OperationsAttendee[];
  isLoading: boolean;
  selectedTicketId: number | null;
  onSelect: (ticketId: number) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onMore: () => void;
  /** 필터가 걸려 있으면 빈 상태 문구가 달라집니다 */
  filtered: boolean;
}

const HEADERS = ['좌석', '예매자', '연락처', '티켓', '예매 상태', '입장', '입장 시각'] as const;

/**
 * 예매자 명단 (순수 View).
 *
 * 🔴 **한 줄 = 티켓 한 장**입니다. 주문 하나로 좌석 여러 장을 살 수 있어 주문 단위로 묶으면
 *    좌석맵의 자리와 1:1 로 이어지지 않습니다.
 *
 * 🔴 이름·연락처는 **서버가 가려서** 보낸 값입니다. 여기서 다시 가리지 않고, 가려지지 않은
 *    값을 기대하지도 않습니다.
 *
 * 줄을 누르면 좌석맵과 **같은 선택 키**(티켓 번호)로 오른쪽 패널이 바뀝니다.
 */
export function OperationsAttendeeTable({
  rows,
  isLoading,
  selectedTicketId,
  onSelect,
  hasMore,
  isLoadingMore,
  onMore,
  filtered,
}: Props) {
  return (
    <AdminRecordTable
      headers={HEADERS}
      isLoading={isLoading}
      isEmpty={rows.length === 0}
      emptyTitle={filtered ? '조건에 맞는 예매자가 없어요' : '아직 예매자가 없어요'}
      emptyDescription={
        filtered
          ? '검색어나 구역·입장 상태 필터를 바꿔 보세요.'
          : '예매가 들어오면 여기에 쌓입니다.'
      }
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onMore={onMore}
    >
      {rows.map((row) => (
        <tr
          key={row.ticketId}
          onClick={() => onSelect(row.ticketId)}
          aria-selected={row.ticketId === selectedTicketId}
          className={
            row.ticketId === selectedTicketId
              ? 'border-line/60 bg-surface-2 cursor-pointer border-b last:border-0'
              : 'border-line/60 hover:bg-surface-2 cursor-pointer border-b last:border-0'
          }
        >
          <td className="text-ink px-4 py-3 font-medium">{seatText(row)}</td>

          <td className="px-4 py-3">
            <p className="text-ink">{row.holderName ?? '—'}</p>
            <p className="text-ink-muted text-xs">{row.holderNickname}</p>
          </td>

          <td className="text-ink-muted px-4 py-3 text-xs tabular-nums">
            {row.holderPhone ?? '—'}
          </td>

          <td className="text-ink-muted px-4 py-3 text-xs tabular-nums">#{row.ticketId}</td>

          {/* 예매 상태와 입장 여부는 **다른 축**입니다 — 한 칸에 합치면 "입장했는데 취소된 표" 를
              표현할 수 없습니다. 칸을 둘로 둡니다. */}
          <td className="px-4 py-3">
            {row.status === 'CANCELLED' ? (
              <Badge tone="danger">예매 취소</Badge>
            ) : (
              <Badge tone="neutral">예매 완료</Badge>
            )}
          </td>

          <td className="px-4 py-3">
            {row.checkedInAt ? (
              /* 입장 완료는 "지금 확인된 것" 이라 강조색을 쓰는 세 자리 중 하나입니다 */
              <Badge tone="accent">입장</Badge>
            ) : (
              <span className="text-ink-subtle text-xs">미입장</span>
            )}
          </td>

          <td className="text-ink-muted px-4 py-3 text-xs tabular-nums">
            {row.checkedInAt ? formatDateTime(row.checkedInAt) : '—'}
          </td>
        </tr>
      ))}
    </AdminRecordTable>
  );
}
