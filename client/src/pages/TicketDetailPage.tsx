import { useNavigate, useParams } from 'react-router-dom';
import { Armchair, Ban, CalendarDays, MapPin, TriangleAlert, UserRound } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Badge, Button, Card } from '@/shared/components/ui';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { useModal } from '@/app/providers';
import { ROUTES } from '@/shared/constants';
import { formatDateTime, formatPrice } from '@/shared/lib';
import { can, useAuth } from '@/features/auth';
import {
  TicketQr,
  isCancelable,
  seatText,
  ticketStatusLabel,
  useCancelTicket,
  useTicketDetail,
} from '@/features/ticket';

export function TicketDetailPage() {
  const navigate = useNavigate();
  const { ticketId = '' } = useParams();
  const { open } = useModal();
  const { user } = useAuth();

  const { data: ticket, isPending, isError } = useTicketDetail(ticketId);
  const cancel = useCancelTicket();

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

  return (
    <>
      <Header title="티켓 상세" showBack />

      <div className="space-y-4 p-4">
        {/* 티켓 카드 */}
        <Card className="ticket-notch space-y-5 py-6">
          <div className="space-y-1 text-center">
            <Badge tone="brand">{ticketStatusLabel(ticket)}</Badge>
            <h1 className="mt-2 text-lg font-extrabold">{ticket.concertTitle}</h1>
            <p className="text-muted text-sm">{ticket.artist}</p>
          </div>

          <div className="flex justify-center">
            <TicketQr
              payload={ticket.qrPayload}
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
                {ticket.ownerName}
                <span className="text-subtle ml-2 text-xs">{formatPrice(ticket.price)}</span>
              </dd>
            </div>
          </dl>
        </Card>

        <p className="text-subtle text-center text-xs leading-relaxed">
          이 티켓은 양도할 수 없습니다.
          <br />
          취소하면 좌석은 추첨 대기자에게 배정됩니다.
        </p>

        {isCancelable(ticket) && (
          <Button
            variant="danger-ghost"
            size="lg"
            fullWidth
            leftIcon={<Ban size={16} />}
            loading={cancel.isPending}
            onClick={() =>
              open('common/confirm', {
                title: '예매를 취소할까요?',
                message:
                  '취소 수수료가 발생할 수 있으며, 취소한 좌석은 추첨 대기자에게 배정됩니다.',
                confirmText: '예매 취소',
                danger: true,
                onConfirm: () => cancel.mutate(ticket.id, { onSuccess: () => navigate(-1) }),
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
