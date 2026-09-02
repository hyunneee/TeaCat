import { mock, mockError } from '../router';
import {
  findConcert,
  findSchedule,
  findSeat,
  findVenue,
  sections,
  tickets,
  type MockTicket,
} from '../db';
import { requireUser } from './auth';

function detail(ticket: MockTicket) {
  const schedule = findSchedule(ticket.scheduleId);
  const concert = schedule ? findConcert(schedule.concertId) : undefined;
  const venue = concert ? findVenue(concert.venueId) : undefined;
  const seat = findSeat(ticket.seatId);
  const section = sections.find((s) => s.id === seat?.sectionId);

  return {
    id: ticket.id,
    orderId: ticket.orderId,
    status: ticket.status,
    price: ticket.price,
    issuedAt: ticket.issuedAt,
    ownerName: ticket.ownerName,
    concertId: concert?.id ?? '',
    concertTitle: concert?.title ?? '',
    artist: concert?.artist ?? '',
    posterSeed: concert?.posterSeed ?? '',
    startAt: schedule?.startAt ?? '',
    venueName: venue?.name ?? '',
    venueAddress: venue?.address ?? '',
    sectionName: section?.name ?? '',
    row: seat?.row ?? '',
    number: seat?.number ?? 0,
    /** 입장 QR 페이로드. 실제 규격은 백엔드와 협의 필요 (플로우차트 주석) */
    qrPayload: `TICKET:${ticket.id}`,
  };
}

mock('GET', '/me/tickets', (ctx) => {
  const user = requireUser(ctx.headers);
  const status = ctx.query.status;

  return tickets
    .filter((t) => t.userId === user.id)
    .filter((t) => !status || t.status === status)
    .map(detail)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
});

mock('GET', '/me/tickets/:ticketId', (ctx) => {
  const user = requireUser(ctx.headers);
  const ticket = tickets.find((t) => t.id === ctx.params.ticketId && t.userId === user.id);
  if (!ticket) throw mockError(404, 'NOT_FOUND', '티켓을 찾을 수 없습니다.');
  return detail(ticket);
});

/* ── 예매 취소 ──
   취소된 좌석은 바로 판매되지 않고 NRF 추첨 대상이 됩니다.
   (플로우차트: 예매 취소 → 취소표 → NRF 랜덤 추첨) */
mock('POST', '/me/tickets/:ticketId/cancel', (ctx) => {
  const user = requireUser(ctx.headers);
  const ticket = tickets.find((t) => t.id === ctx.params.ticketId && t.userId === user.id);

  if (!ticket) throw mockError(404, 'NOT_FOUND', '티켓을 찾을 수 없습니다.');
  if (ticket.status !== 'VALID') throw mockError(400, 'ALREADY_CANCELED', '이미 취소된 티켓입니다.');

  ticket.status = 'CANCELED';

  const seat = findSeat(ticket.seatId);
  if (seat) {
    // AVAILABLE 로 바로 풀지 않고 추첨 풀로 보냅니다.
    seat.status = 'BLOCKED';
    seat.ownerId = null;
  }

  return { ticketId: ticket.id, refundAmount: Math.round(ticket.price * 0.9) };
});
