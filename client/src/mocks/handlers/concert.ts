import { mock, mockError } from '../router';
import {
  concerts,
  findConcert,
  findSchedule,
  findVenue,
  schedules,
  seats,
  sections,
  type MockConcert,
} from '../db';

function availableCount(scheduleId: string) {
  return seats.filter((s) => s.scheduleId === scheduleId && s.status === 'AVAILABLE').length;
}

function totalCount(scheduleId: string) {
  return seats.filter((s) => s.scheduleId === scheduleId && s.status !== 'BLOCKED').length;
}

function summary(concert: MockConcert) {
  const venue = findVenue(concert.venueId);
  const list = schedules.filter((s) => s.concertId === concert.id);
  const first = list[0];
  const last = list.at(-1);

  return {
    id: concert.id,
    title: concert.title,
    artist: concert.artist,
    posterSeed: concert.posterSeed,
    genre: concert.genre,
    venueName: venue?.name ?? '',
    openAt: concert.openAt,
    firstShowAt: first?.startAt ?? null,
    lastShowAt: last?.startAt ?? null,
    /** 예매 오픈 전이면 true */
    upcoming: new Date(concert.openAt).getTime() > Date.now(),
  };
}

/* ── 목록 ── */
mock('GET', '/concerts', (ctx) => {
  const keyword = (ctx.query.keyword ?? '').trim().toLowerCase();

  const filtered = concerts.filter(
    (c) =>
      !keyword ||
      c.title.toLowerCase().includes(keyword) ||
      c.artist.toLowerCase().includes(keyword),
  );

  return { items: filtered.map(summary), nextCursor: null, hasNext: false };
});

/* ── 상세 ── */
mock('GET', '/concerts/:concertId', (ctx) => {
  const concert = findConcert(ctx.params.concertId ?? '');
  if (!concert) throw mockError(404, 'NOT_FOUND', '공연을 찾을 수 없습니다.');

  const venue = findVenue(concert.venueId);

  return {
    ...summary(concert),
    runningMinutes: concert.runningMinutes,
    ageLimit: concert.ageLimit,
    description: concert.description,
    venue: venue ? { id: venue.id, name: venue.name, address: venue.address } : null,
    schedules: schedules
      .filter((s) => s.concertId === concert.id)
      .map((s) => ({
        id: s.id,
        startAt: s.startAt,
        openAt: s.openAt,
        maxPerUser: s.maxPerUser,
        availableSeats: availableCount(s.id),
        totalSeats: totalCount(s.id),
        /** 예매 오픈 전이면 대기 */
        status: new Date(s.openAt).getTime() > Date.now() ? 'UPCOMING' : 'OPEN',
      })),
  };
});

/* ── 회차 단건 (예매 플로우 중 헤더에 공연명 표시용) ── */
mock('GET', '/schedules/:scheduleId', (ctx) => {
  const schedule = findSchedule(ctx.params.scheduleId ?? '');
  if (!schedule) throw mockError(404, 'NOT_FOUND', '회차를 찾을 수 없습니다.');

  const concert = findConcert(schedule.concertId);
  const venue = concert ? findVenue(concert.venueId) : undefined;

  return {
    id: schedule.id,
    startAt: schedule.startAt,
    maxPerUser: schedule.maxPerUser,
    concertId: schedule.concertId,
    concertTitle: concert?.title ?? '',
    artist: concert?.artist ?? '',
    posterSeed: concert?.posterSeed ?? '',
    venueName: venue?.name ?? '',
    sectionCount: sections.filter((s) => s.scheduleId === schedule.id).length,
  };
});
