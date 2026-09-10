import { useNavigate, useParams } from 'react-router-dom';
import {
  Armchair,
  Ban,
  CalendarDays,
  MapPin,
  Receipt,
  ScanFace,
  TriangleAlert,
} from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Badge, Button, Card } from '@/shared/components/ui';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { useModal } from '@/app/providers';
import { ROUTES } from '@/shared/constants';
import { formatDateTime, formatPrice } from '@/shared/lib';
import { can, useAuth } from '@/features/auth';
import {
  isCancelable,
  isUsable,
  nftStatusLabel,
  seatText,
  ticketStatusLabel,
  ticketTone,
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

  /* 입장은 얼굴 인식으로 합니다. 아직 등록 전이면 관람 전에 끝내라고 안내합니다 —
     지난 티켓·취소된 티켓에는 띄우지 않습니다 (할 일이 아니니까) */
  const needsFace = isUsable(ticket) && !can.useTicket(user);
  const nftLabel = nftStatusLabel(ticket.nftStatus);
  const orderId = ticket.orderId;

  return (
    <>
      <Header title="티켓 상세" showBack />

      <div className="space-y-4 p-4">
        <Card className="ticket-notch space-y-5 py-6">
          <div className="space-y-1 text-center">
            <Badge tone={ticketTone(ticket)}>{ticketStatusLabel(ticket)}</Badge>
            <h1 className="mt-2 text-lg font-extrabold">{ticket.concertTitle}</h1>
            <p className="text-muted text-sm">{ticket.performanceNum}회차</p>
          </div>

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
            {ticket.price !== null && (
              <div className="flex items-center gap-2">
                <Receipt size={15} className="text-subtle shrink-0" />
                <dt className="sr-only">결제 금액</dt>
                <dd>
                  {formatPrice(ticket.price)}
                  <span className="text-subtle ml-2 text-xs">
                    {formatDateTime(ticket.bookedAt)} 예매
                  </span>
                </dd>
              </div>
            )}
          </dl>

          {/* NFT 발행은 예매와 다른 축입니다 — 발행 중이어도 예매는 이미 유효합니다.
              그래서 상태 줄을 따로 두고, 실패도 "재시도 중" 으로만 씁니다 */}
          {nftLabel && (
            <p className="text-subtle border-t pt-4 text-xs">
              NFT 티켓 {nftLabel}
              {ticket.tokenId && <span className="ml-1 font-mono">#{ticket.tokenId}</span>}
            </p>
          )}
        </Card>

        {needsFace && (
          <Button
            variant="secondary"
            fullWidth
            leftIcon={<ScanFace size={16} />}
            onClick={() => navigate(ROUTES.FACE_REGISTER)}
          >
            얼굴 등록하러 가기
          </Button>
        )}

        <p className="text-subtle text-center text-xs leading-relaxed">
          이 티켓은 양도할 수 없습니다.
          <br />
          취소하면 좌석은 추첨 대기자에게 배정됩니다.
        </p>

        {isCancelable(ticket) && orderId && (
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
