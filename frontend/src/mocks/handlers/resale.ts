import { mock, mockError } from '../router';
import {
  findConcert,
  findSchedule,
  iso,
  now,
  resaleEntries,
  sections,
  type MockResaleEntry,
} from '../db';
import { requireUser } from './auth';

/**
 * 취소표 추첨 대기.
 *
 * 플로우차트:
 *   구역 → 취소표 예약대기 → NRF 랜덤 추첨 → 당첨 시 메일 → 12시간 내 결제 → 예매
 *   (좌석 선택 기한 만료 시에도 NRF 추첨 풀로 돌아감)
 *
 * 실제 추첨은 블록체인 NRF(검증 가능한 난수)로 서버가 돌립니다.
 * 목업은 "신청 → 대기" 까지만 재현하고, 데모용 즉시 추첨 API 를 하나 둡니다.
 */

const WIN_DEADLINE_HOURS = 12;

function detail(entry: MockResaleEntry) {
  const schedule = findSchedule(entry.scheduleId);
  const concert = schedule ? findConcert(schedule.concertId) : undefined;
  const section = sections.find((s) => s.id === entry.sectionId);

  return {
    id: entry.id,
    scheduleId: entry.scheduleId,
    sectionId: entry.sectionId,
    sectionName: section?.name ?? '',
    grade: section?.grade ?? '',
    price: section?.price ?? 0,
    quantity: entry.quantity,
    status: entry.status,
    deadlineAt: entry.deadlineAt,
    createdAt: entry.createdAt,
    concertTitle: concert?.title ?? '',
    artist: concert?.artist ?? '',
    posterSeed: concert?.posterSeed ?? '',
    startAt: schedule?.startAt ?? '',
  };
}

/* ── 구역별 대기 현황 ── */
mock('GET', '/schedules/:scheduleId/resale/sections', (ctx) => {
  const scheduleId = ctx.params.scheduleId ?? '';

  return sections
    .filter((s) => s.scheduleId === scheduleId)
    .map((section) => ({
      sectionId: section.id,
      name: section.name,
      grade: section.grade,
      price: section.price,
      waitingCount:
        resaleEntries.filter((e) => e.sectionId === section.id && e.status === 'WAITING').length +
        // 대기 인원이 0명이면 화면이 심심해서 시드값을 섞습니다 (목업 전용)
        ((section.name.length * 17) % 40),
    }));
});

/* ── 대기 신청 ──
   구역별로 신청하고, 최대 구매 가능 수량까지 중복 신청할 수 있습니다. */
mock('POST', '/schedules/:scheduleId/resale', (ctx) => {
  const user = requireUser(ctx.headers);
  const scheduleId = ctx.params.scheduleId ?? '';
  const schedule = findSchedule(scheduleId);
  if (!schedule) throw mockError(404, 'NOT_FOUND', '회차를 찾을 수 없습니다.');

  const { sectionId, quantity } = ctx.body as { sectionId?: string; quantity?: number };
  const qty = quantity ?? 1;

  if (!sectionId) throw mockError(400, 'BAD_REQUEST', '구역을 선택해 주세요.');
  if (qty > schedule.maxPerUser) {
    throw mockError(
      400,
      'PURCHASE_LIMIT_EXCEEDED',
      `1인 최대 ${schedule.maxPerUser}매까지 신청할 수 있습니다.`,
    );
  }

  const duplicated = resaleEntries.some(
    (e) => e.userId === user.id && e.sectionId === sectionId && e.status === 'WAITING',
  );
  if (duplicated) throw mockError(409, 'DUPLICATE_REQUEST', '이미 신청한 구역입니다.');

  const entry: MockResaleEntry = {
    id: `re-${Date.now()}`,
    scheduleId,
    sectionId,
    userId: user.id,
    quantity: qty,
    status: 'WAITING',
    deadlineAt: null,
    createdAt: iso(now()),
  };
  resaleEntries.push(entry);

  return detail(entry);
});

/* ── 내 대기 목록 ── */
mock('GET', '/me/resale', (ctx) => {
  const user = requireUser(ctx.headers);
  return resaleEntries.filter((e) => e.userId === user.id).map(detail);
});

/* ── 대기 취소 ── */
mock('DELETE', '/resale/:entryId', (ctx) => {
  const user = requireUser(ctx.headers);
  const index = resaleEntries.findIndex((e) => e.id === ctx.params.entryId && e.userId === user.id);
  if (index < 0) throw mockError(404, 'NOT_FOUND', '신청 내역을 찾을 수 없습니다.');

  resaleEntries.splice(index, 1);
  return null;
});

/* ── [목업 전용] 즉시 추첨 ──
   실제로는 서버가 취소표 발생 시점에 NRF 로 돌립니다.
   데모에서 당첨 화면을 보여주기 위한 버튼용 API 입니다. */
mock('POST', '/resale/:entryId/draw', (ctx) => {
  const user = requireUser(ctx.headers);
  const entry = resaleEntries.find((e) => e.id === ctx.params.entryId && e.userId === user.id);
  if (!entry) throw mockError(404, 'NOT_FOUND', '신청 내역을 찾을 수 없습니다.');

  const won = Math.random() < 0.5;
  entry.status = won ? 'WON' : 'LOST';
  entry.deadlineAt = won ? iso(now() + WIN_DEADLINE_HOURS * 3600_000) : null;

  return {
    ...detail(entry),
    // 실제 NRF 는 검증 가능한 난수와 증명을 함께 내려줍니다.
    randomness: `0x${Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')}`,
  };
});
