import { useNavigate, useParams } from 'react-router-dom';
import { Armchair, Ban, CalendarDays, Info, MapPin, TriangleAlert, UserRound } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Badge, Button, Card } from '@/shared/components/ui';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { useModal } from '@/app/providers';
import { ROUTES } from '@/shared/constants';
import { formatDateTime, formatPrice } from '@/shared/lib';
import { can, useAuth } from '@/features/auth';
import { useCancelOrder, useTicketOrder } from '@/features/payment';
import {
  TicketQr,
  isCancelable,
  nftIssueNote,
  qrPayload,
  seatText,
  ticketStatusLabel,
  useTicketDetail,
} from '@/features/ticket';

export function TicketDetailPage() {
  const navigate = useNavigate();
  const { ticketId = '' } = useParams();
  const { open } = useModal();
  const { user } = useAuth();

  const { data: ticket, isPending, isError } = useTicketDetail(ticketId);
  /* 결제 금액은 티켓이 아니라 **주문**에 있습니다. 티켓이 오기 전에는 부를 수 없어
     조건부 쿼리로 둡니다 (훅은 이른 return 위에 있어야 하므로 여기서 부릅니다) */
  const { data: order } = useTicketOrder(ticket?.orderId ?? null);
  const cancel = useCancelOrder();

  if (isPending) return <PageLoader />;
  if (isError || !ticket) {
    return (
      <>
        <Header title="티켓" showBack />
        <EmptyState icon={TriangleAlert} title="티켓을 불러오지 못했어요" />
      </>
    );
  }

  const faceReady = can.useTicket(user);
  const issueNote = nftIssueNote(ticket);
  /* 지역 상수로 꺼내야 콜백 안에서도 null 이 아님이 유지됩니다 */
  const orderId = ticket.orderId;

  return (
    <>
      <Header title="티켓 상세" showBack />

      <div className="space-y-4 p-4">
        {/* 티켓 카드 */}
        <Card className="ticket-notch space-y-5 py-6">
          <div className="space-y-1 text-center">
            <Badge tone="brand">{ticketStatusLabel(ticket)}</Badge>
            <h1 className="mt-2 text-lg font-extrabold">{ticket.concertTitle}</h1>
            <p className="text-muted text-sm">{ticket.performanceNum}회차</p>
          </div>

          <div className="flex justify-center">
            <TicketQr
              payload={qrPayload(ticket)}
              locked={!faceReady}
              lockMessage="얼굴 등록 후 입장할 수 있어요"
            />
          </div>

          {!faceReady && (
            <Button variant="secondary" fullWidth onClick={() => navigate(ROUTES.FACE_REGISTER)}>
              얼굴 등록하러 가기
            </Button>
          )}

          <dl className="space-y-2.5 border-t pt-4 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays size={15} className="text-subtle shrink-0" />
              <dt className="sr-only">일시</dt>
              <dd>{formatDateTime(ticket.startAt)}</dd>
            </div>
            <div className="flex items-start gap-2">
              <MapPin size={15} className="text-subtle mt-0.5 shrink-0" />
              <dt className="sr-only">장소</dt>
              <dd>
                {ticket.venueName}
                <span className="text-subtle block text-xs">{ticket.venueAddress}</span>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <Armchair size={15} className="text-subtle shrink-0" />
              <dt className="sr-only">좌석</dt>
              <dd className="font-semibold">{seatText(ticket)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <UserRound size={15} className="text-subtle shrink-0" />
              <dt className="sr-only">사용자</dt>
              <dd>
                {user?.nickname ?? '본인'}
                {/* 금액은 주문이 도착해야 압니다. 오기 전에는 자리만 비워 둡니다 */}
                {order && (
                  <span className="text-subtle ml-2 text-xs">{formatPrice(order.totalAmount)}</span>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        {/* NFT 발행은 예매와 다른 축입니다 — 실패로 읽히지 않게 안내 톤으로 둡니다 */}
        {issueNote && (
          <Card flat className="flex gap-3">
            <Info size={17} className="text-ink-muted mt-0.5 shrink-0" />
            <p className="text-muted text-xs leading-relaxed">{issueNote}</p>
          </Card>
        )}

        <p className="text-subtle text-center text-xs leading-relaxed">
          이 티켓은 양도할 수 없습니다.
          <br />
          취소하면 좌석이 바로 다시 판매되고, 결제하신 금액은 전액 환불됩니다.
        </p>

        {isCancelable(ticket) && orderId !== null && (
          <Button
            variant="danger-ghost"
            size="lg"
            fullWidth
            leftIcon={<Ban size={16} />}
            loading={cancel.isPending}
            onClick={() =>
              open('common/confirm', {
                title: '예매를 취소할까요?',
                message: '좌석이 바로 풀려서 다른 분이 가져갈 수 있어요. 되돌릴 수 없습니다.',
                confirmText: '예매 취소',
                danger: true,
                onConfirm: () => cancel.mutate(orderId, { onSuccess: () => navigate(-1) }),
              })
            }
          >
            예매 취소
          </Button>
        )}
      </div>
    </>
  );
}
