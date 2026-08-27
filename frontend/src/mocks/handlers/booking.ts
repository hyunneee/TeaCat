import { mock, mockError } from '../router';
import {
  findSchedule,
  findSeat,
  holds,
  iso,
  now,
  seats,
  sections,
  tickets,
  type MockHold,
} from '../db';
import { requireOtp, requireUser } from './auth';

/** 좌석을 잡아두는 시간. shared/constants 의 SEAT_HOLD_SECONDS 와 같아야 합니다. */
const HOLD_SECONDS = 420;

/** 만료된 hold 를 정리하고 좌석을 풀어줍니다. (서버 TTL 흉내) */
function sweepExpiredHolds() {
  const current = now();

  for (let i = holds.length - 1; i >= 0; i -= 1) {
    const hold = holds[i] as MockHold;
    if (new Date(hold.expiresAt).getTime() > current) continue;

    hold.seatIds.forEach((seatId) => {
      const seat = findSeat(seatId);
      if (seat && seat.status === 'HELD' && seat.ownerId === hold.userId) {
        seat.status = 'AVAILABLE';
        seat.ownerId = null;
      }
    });
    holds.splice(i, 1);
  }
}

/* ── 구역 목록 (플로우: OTP → 구역) ── */
mock('GET', '/schedules/:scheduleId/sections', (ctx) => {
  sweepExpiredHolds();
  const scheduleId = ctx.params.scheduleId ?? '';

  return sections
    .filter((s) => s.scheduleId === scheduleId)
    .map((section) => {
      const mine = seats.filter((seat) => seat.sectionId === section.id);
      return {
        id: section.id,
        name: section.name,
        grade: section.grade,
        price: section.price,
        totalSeats: mine.filter((s) => s.status !== 'BLOCKED').length,
        availableSeats: mine.filter((s) => s.status === 'AVAILABLE').length,
        origin: section.origin,
        cols: section.cols,
        rows: section.rows,
      };
    });
});

/* ── 좌석맵 ── */
mock('GET', '/schedules/:scheduleId/seats', (ctx) => {
  sweepExpiredHolds();

  const scheduleId = ctx.params.scheduleId ?? '';
  const schedule = findSchedule(scheduleId);
  if (!schedule) throw mockError(404, 'NOT_FOUND', '회차를 찾을 수 없습니다.');

  const sectionId = ctx.query.sectionId;
  const scoped = seats.filter(
    (s) => s.scheduleId === scheduleId && (!sectionId || s.sectionId === sectionId),
  );

  return {
    scheduleId,
    maxPerUser: schedule.maxPerUser,
    sections: sections
      .filter((s) => s.scheduleId === scheduleId && (!sectionId || s.id === sectionId))
      .map((s) => ({ id: s.id, name: s.name, grade: s.grade, price: s.price })),
    seats: scoped.map((s) => ({
      id: s.id,
      sectionId: s.sectionId,
      row: s.row,
      number: s.number,
      price: s.price,
      status: s.status,
      x: s.x,
      y: s.y,
    })),
  };
});

/* ── 좌석 선점 (락) ── */
mock('POST', '/schedules/:scheduleId/holds', (ctx) => {
  sweepExpiredHolds();

  const user = requireUser(ctx.headers);
  const scheduleId = ctx.params.scheduleId ?? '';
  const schedule = findSchedule(scheduleId);
  if (!schedule) throw mockError(404, 'NOT_FOUND', '회차를 찾을 수 없습니다.');

  requireOtp(user.id, scheduleId);

  const { seatIds } = ctx.body as { seatIds?: string[] };
  const targets = seatIds ?? [];

  if (targets.length === 0) throw mockError(400, 'BAD_REQUEST', '좌석을 선택해 주세요.');

  // 1인 최대 매수 검사 (이미 산 티켓 + 이번 요청)
  const owned = tickets.filter(
    (t) => t.userId === user.id && t.scheduleId === scheduleId && t.status === 'VALID',
  ).length;

  if (owned + targets.length > schedule.maxPerUser) {
    throw mockError(
      400,
      'PURCHASE_LIMIT_EXCEEDED',
      `1인 최대 ${schedule.maxPerUser}매까지 구매할 수 있습니다.`,
    );
  }

  // 하나라도 못 잡으면 전부 실패 (원자성)
  const resolved = targets.map((id) => findSeat(id));
  const blocked = resolved.find((seat) => !seat || seat.status !== 'AVAILABLE');
  if (blocked !== undefined) {
    throw mockError(409, 'SEAT_ALREADY_HELD', '이미 선택된 좌석이 포함되어 있습니다.');
  }

  resolved.forEach((seat) => {
    if (!seat) return;
    seat.status = 'HELD';
    seat.ownerId = user.id;
  });

  const hold: MockHold = {
    holdId: `h-${Date.now()}`,
    scheduleId,
    seatIds: targets,
    userId: user.id,
    expiresAt: iso(now() + HOLD_SECONDS * 1000),
  };
  holds.push(hold);

  return hold;
});

/* ── 선점 조회 (결제 페이지 새로고침 대비) ── */
mock('GET', '/holds/:holdId', (ctx) => {
  sweepExpiredHolds();

  const hold = holds.find((h) => h.holdId === ctx.params.holdId);
  if (!hold) throw mockError(410, 'SEAT_HOLD_EXPIRED', '좌석 선점이 만료되었습니다.');

  return {
    ...hold,
    seats: hold.seatIds.map((id) => {
      const seat = findSeat(id);
      const section = sections.find((s) => s.id === seat?.sectionId);
      return {
        id,
        sectionName: section?.name ?? '',
        row: seat?.row ?? '',
        number: seat?.number ?? 0,
        price: seat?.price ?? 0,
      };
    }),
  };
});

/* ── 선점 해제 ── */
mock('DELETE', '/holds/:holdId', (ctx) => {
  const index = holds.findIndex((h) => h.holdId === ctx.params.holdId);
  if (index < 0) return null;

  const hold = holds[index] as MockHold;
  hold.seatIds.forEach((seatId) => {
    const seat = findSeat(seatId);
    if (seat && seat.status === 'HELD') {
      seat.status = 'AVAILABLE';
      seat.ownerId = null;
    }
  });
  holds.splice(index, 1);
  return null;
});

/* 결제(주문 생성·승인)는 handlers/payment.ts 가 담당합니다.
   PG 인증 → 백엔드 검증 → 티켓 발급 순서를 그쪽에서 재현합니다. */
