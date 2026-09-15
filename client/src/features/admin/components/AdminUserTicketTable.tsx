import { Badge } from '@/shared/components/ui';
import { formatDateTime } from '@/shared/lib';
import { nftStatusLabel, seatText, ticketStatusLabel, ticketTone, type Ticket } from '@/features/ticket';
import { AdminRecordTable } from './AdminRecordTable';

/**
 * 회원 상세 — 예매 탭.
 *
 * 🔴 <b>취소된 예매도 그립니다.</b> 사용자 화면은 지난 것을 접어두지만, 관리자가 이 표를 보는
 * 이유는 대개 "취소했다는데요" 같은 문의라 취소가 빠지면 표를 볼 이유가 없어집니다.
 * 상태 칩이 취소를 붉게 알려줍니다.
 *
 * 문구·색은 사용자 화면과 <b>같은 model 함수</b>를 씁니다 — 여기서 다시 쓰면 관리자와
 * 사용자가 서로 다른 말을 보게 됩니다.
 */
export interface AdminUserTicketTableProps {
  tickets: Ticket[];
  isLoading: boolean;
}

const HEADERS = ['공연', '일시', '좌석', '예매일', '상태', 'NFT'] as const;

export function AdminUserTicketTable({ tickets, isLoading }: AdminUserTicketTableProps) {
  return (
    <AdminRecordTable
      headers={HEADERS}
      isLoading={isLoading}
      isEmpty={tickets.length === 0}
      emptyTitle="예매한 공연이 없어요"
      emptyDescription="이 회원이 예매하면 여기에 쌓입니다."
    >
      {tickets.map((ticket) => {
        const nft = nftStatusLabel(ticket.nftStatus);

        return (
          <tr key={ticket.id} className="border-line/60 hover:bg-surface-2 border-b last:border-0">
            <td className="px-4 py-3">
              <p className="text-ink font-medium">{ticket.concertTitle}</p>
              <p className="text-ink-muted text-xs">
                {ticket.venueName} · {ticket.performanceNum}회차
              </p>
            </td>

            <td className="text-ink-muted px-4 py-3 text-xs tabular-nums">
              {formatDateTime(ticket.startAt)}
            </td>

            <td className="text-ink px-4 py-3">{seatText(ticket)}</td>

            <td className="text-ink-muted px-4 py-3 text-xs tabular-nums">
              {formatDateTime(ticket.bookedAt)}
            </td>

            <td className="px-4 py-3">
              <Badge tone={ticketTone(ticket)}>{ticketStatusLabel(ticket)}</Badge>
            </td>

            {/* 🔴 NFT 상태는 **예매 상태와 다른 축**입니다. 발행 중이어도 예매는 유효하므로
                실패처럼 붉게 칠하지 않습니다 */}
            <td className="px-4 py-3">
              {nft ? (
                <span className="text-ink-muted text-xs">{nft}</span>
              ) : (
                <span className="text-ink-subtle text-xs">—</span>
              )}
            </td>
          </tr>
        );
      })}
    </AdminRecordTable>
  );
}
