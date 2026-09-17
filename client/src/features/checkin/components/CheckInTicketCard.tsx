import { Armchair, CalendarDays, CircleUser, TriangleAlert } from 'lucide-react';
import { Card } from '@/shared/components/ui';
import { formatDateTime } from '@/shared/lib';
import type { CheckInTicket } from '../model/checkIn.types';

interface Props {
  ticket: CheckInTicket;
}

/**
 * 얼굴을 찍기 전에 사람이 눈으로 확인하는 카드.
 *
 * ⚠️ 여기 뜬다고 입장이 아닙니다 — 표가 이 회차의 것이라는 뜻까지입니다.
 */
export function CheckInTicketCard({ ticket }: Props) {
  const seat =
    ticket.rowLabel && ticket.seatNumber !== null
      ? `${ticket.areaCode}구역 ${ticket.rowLabel}열 ${ticket.seatNumber}번`
      : `${ticket.areaCode}구역 (스탠딩)`;

  return (
    <Card className="space-y-3">
      <div>
        <p className="text-base font-extrabold">{ticket.title}</p>
        <p className="text-muted text-sm">{ticket.performanceNum}회차</p>
      </div>

      <dl className="space-y-2 border-t pt-3 text-sm">
        <div className="flex items-center gap-2">
          <CircleUser size={15} className="text-subtle shrink-0" />
          <dt className="sr-only">예매자</dt>
          <dd className="font-semibold">{ticket.holderNickname}</dd>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-subtle shrink-0" />
          <dt className="sr-only">일시</dt>
          <dd>{formatDateTime(ticket.performanceDate)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Armchair size={15} className="text-subtle shrink-0" />
          <dt className="sr-only">좌석</dt>
          <dd className="font-semibold">{seat}</dd>
        </div>
      </dl>

      {/* 🔴 대조할 얼굴이 없는 표입니다. 얼굴을 찍어봐야 서버가 거절하므로 미리 알려줍니다 */}
      {!ticket.faceVerifiable && (
        <div className="bg-warning-soft text-warning flex gap-2 rounded-xl p-3">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed">
            <b>얼굴로 확인할 수 없는 표예요.</b>
            <br />
            예매할 때 얼굴을 등록하지 않았습니다. 현장 규정에 따라 신분증으로 확인해 주세요.
          </p>
        </div>
      )}
    </Card>
  );
}
