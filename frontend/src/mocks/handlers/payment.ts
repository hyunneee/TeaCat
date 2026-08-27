import { mock, mockError } from '../router';
import { findConcert, findSchedule, findSeat, holds, iso, now, sections, tickets, users } from '../db';
import { requireUser } from './auth';

/**
 * 결제 목업 (토스페이먼츠).
 *
 * 실제 백엔드가 해야 하는 일을 같은 순서로 흉내냅니다.
 *   prepare — 좌석 선점을 확인하고 **서버가 금액과 orderId 를 확정**
 *   confirm — (실서버) 토스 승인 API 호출 → 금액 검증 → 티켓 발급
 *
 * 백엔드가 완성되면 이 파일만 지우면 됩니다.
 * 프론트의 `features/payment` 는 손대지 않습니다.
 */

/** paymentId → 준비된 결제 정보. 실서버에서는 DB 의 주문 테이블입니다. */
interface PreparedPayment {
  paymentId: string;
  holdId: string;
  userId: string;
  amount: number;
  recipients: { seatId: string; loginId: string }[];
  status: 'PREPARED' | 'PAID';
}

const prepared = new Map<string, PreparedPayment>();

/** 예매 수수료 (매당) — 실제 정책은 백엔드와 합의 필요 */
const FEE_PER_TICKET = 2000;

mock('POST', '/payments/prepare', (ctx) => {
  const user = requireUser(ctx.headers);
  const { holdId, recipients } = ctx.body as {
    holdId?: string;
    recipients?: { seatId: string; loginId: string }[];
  };

  const hold = holds.find((h) => h.holdId === holdId);
  if (!hold) {
    throw mockError(410, 'SEAT_HOLD_EXPIRED', '좌석 선점이 만료되었습니다. 다시 선택해 주세요.');
  }
  if (hold.userId !== user.id) throw mockError(403, 'FORBIDDEN', '권한이 없습니다.');

  // 수령인 검증 — 단순 양도를 막기 위해 결제 전에 확정합니다.
  const recipientMap = new Map((recipients ?? []).map((r) => [r.seatId, r.loginId]));
  for (const seatId of hold.seatIds) {
    const loginId = recipientMap.get(seatId);
    if (!loginId) throw mockError(400, 'BAD_REQUEST', '티켓을 받을 사람을 지정해 주세요.');
    if (!users.some((u) => u.loginId === loginId)) {
      throw mockError(404, 'RECIPIENT_NOT_FOUND', `'${loginId}' 아이디를 찾을 수 없습니다.`);
    }
  }

  // 💡 금액은 서버가 계산합니다. 프론트가 보낸 금액은 쓰지 않습니다.
  const seatPrices = hold.seatIds.map((id) => findSeat(id)?.price ?? 0);
  const amount = seatPrices.reduce((sum, p) => sum + p, 0) + FEE_PER_TICKET * hold.seatIds.length;

  const schedule = findSchedule(hold.scheduleId);
  const concert = schedule ? findConcert(schedule.concertId) : undefined;
  const firstSeat = findSeat(hold.seatIds[0] ?? '');
  const section = sections.find((s) => s.id === firstSeat?.sectionId);

  const orderName =
    hold.seatIds.length > 1
      ? `${concert?.title ?? '공연'} ${section?.name ?? ''} 외 ${hold.seatIds.length - 1}석`
      : `${concert?.title ?? '공연'} ${section?.name ?? ''} ${firstSeat?.row ?? ''}열 ${firstSeat?.number ?? ''}번`;

  /* 토스 orderId 규격: 6~64자, 영문·숫자·`-`·`_` 만 허용.
     한글이나 다른 특수문자가 들어가면 결제창 요청이 거부됩니다. */
  const paymentId = `tikat-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  prepared.set(paymentId, {
    paymentId,
    holdId: hold.holdId,
    userId: user.id,
    amount,
    recipients: recipients ?? [],
    status: 'PREPARED',
  });

  return {
    paymentId,
    orderName,
    totalAmount: amount,
    currency: 'KRW',
    customer: {
      customerId: user.id,
      fullName: user.name,
      phoneNumber: user.phone,
      email: user.email,
    },
  };
});

/** 멱등키 → 이미 처리된 응답 */
const confirmedByKey = new Map<string, unknown>();

mock('POST', '/payments/confirm', (ctx) => {
  const user = requireUser(ctx.headers);

  // 같은 결제가 두 번 승인되지 않게. 진짜 서버가 반드시 해야 하는 일입니다.
  const key = ctx.headers['idempotency-key'];
  if (key && confirmedByKey.has(key)) return confirmedByKey.get(key);

  const { paymentId, paymentKey, amount } = ctx.body as {
    paymentId?: string;
    paymentKey?: string;
    amount?: number;
  };
  const order = prepared.get(paymentId ?? '');

  if (!order) throw mockError(404, 'PAYMENT_NOT_FOUND', '결제 정보를 찾을 수 없습니다.');
  if (order.userId !== user.id) throw mockError(403, 'FORBIDDEN', '권한이 없습니다.');
  if (order.status === 'PAID') {
    throw mockError(409, 'ALREADY_PAID', '이미 결제된 주문입니다.');
  }
  if (!paymentKey) throw mockError(400, 'BAD_REQUEST', '결제 인증 정보가 없습니다.');

  /* 💡 금액 검증 — 실서버에서 절대 빼먹으면 안 되는 부분입니다.
        프론트가 보낸 amount 는 주소창(successUrl 쿼리)에서 온 값이라 조작될 수 있습니다.
        서버가 prepare 때 저장한 금액과 비교하고, 다르면 승인하지 않습니다. */
  if (typeof amount === 'number' && amount !== order.amount) {
    throw mockError(400, 'AMOUNT_MISMATCH', '결제 금액이 일치하지 않습니다.');
  }

  /* ⚠️ 실제 백엔드는 여기서 토스 승인 API 를 호출합니다.
        POST https://api.tosspayments.com/v1/payments/confirm
        Authorization: Basic base64(SECRET_KEY + ':')
        { paymentKey, orderId, amount }   ← amount 는 **서버가 저장한 값**을 씁니다

        가상계좌는 이 시점에 status 가 WAITING_FOR_DEPOSIT 이라
        입금 웹훅을 받아야 최종 완료됩니다. (아직 미구현) */

  const hold = holds.find((h) => h.holdId === order.holdId);
  if (!hold) {
    throw mockError(410, 'SEAT_HOLD_EXPIRED', '좌석 선점이 만료되었습니다. 환불 후 재시도해 주세요.');
  }

  const orderId = `o-${Date.now()}`;
  const recipientMap = new Map(order.recipients.map((r) => [r.seatId, r.loginId]));

  const issued = hold.seatIds.map((seatId, i) => {
    const seat = findSeat(seatId);
    const recipient = users.find((u) => u.loginId === recipientMap.get(seatId));

    if (seat) {
      seat.status = 'SOLD';
      seat.ownerId = recipient?.id ?? user.id;
    }

    const ticket = {
      id: `t-${Date.now()}-${i}`,
      orderId,
      userId: recipient?.id ?? user.id,
      scheduleId: hold.scheduleId,
      seatId,
      ownerName: recipient?.name ?? user.name,
      status: 'VALID' as const,
      price: seat?.price ?? 0,
      issuedAt: iso(now()),
    };
    tickets.push(ticket);
    return ticket;
  });

  holds.splice(holds.indexOf(hold), 1);
  order.status = 'PAID';

  const result = {
    orderId,
    ticketIds: issued.map((t) => t.id),
    totalPrice: order.amount,
    paidAt: iso(now()),
  };

  if (key) confirmedByKey.set(key, result);
  return result;
});
