/** 운영 콘솔 좌석·예매자 회귀 검증: node scripts/check-seat-attendees.mjs
 *
 * 실제 사이드바·모델·좌석맵·명단 컴포넌트를 SSR 해서 확인한다. API 는 호출하지 않는다.
 * 브라우저가 필요한 레이아웃 검증은 check-poca-detail.mjs 쪽에 있다.
 */
import { build } from 'esbuild';
import { join, resolve } from 'node:path';

const root = process.cwd();
const real = (path, names) => `export {${names}} from ${JSON.stringify(join(root, 'src', path))};`;

const source = `
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {AdminSidebar} from './src/features/admin/components/AdminSidebar';
import {OperationsSeatMap} from './src/features/operations/components/OperationsSeatMap';
import {OperationsStandingList} from './src/features/operations/components/OperationsStandingList';
import {OperationsAttendeeTable} from './src/features/operations/components/OperationsAttendeeTable';
import {BottomBar} from './src/shared/components/layout/BottomBar';
export * as model from './src/features/operations/model/operations.model';
export * as geometry from './src/shared/lib/seatGeometry';
export const sidebar = (role) => renderToStaticMarkup(
  <MemoryRouter initialEntries={['/admin']}><AdminSidebar user={{role}}/></MemoryRouter>);
export const seatMap = (areas, selectedTicketId) => renderToStaticMarkup(
  <OperationsSeatMap areas={areas} selectedTicketId={selectedTicketId} onSelectSeat={()=>{}}/>);
export const standing = (areas) => renderToStaticMarkup(
  <OperationsStandingList areas={areas} selectedAreaId={null} onPickArea={()=>{}}/>);
export const attendees = (rows, selectedTicketId) => renderToStaticMarkup(
  <OperationsAttendeeTable rows={rows} isLoading={false} selectedTicketId={selectedTicketId}
    onSelect={()=>{}} hasMore={false} isLoadingMore={false} onMore={()=>{}} filtered={false}/>);
export const bottomBar = (inlineOnDesktop) => renderToStaticMarkup(
  <BottomBar inlineOnDesktop={inlineOnDesktop}><button type="button">확인</button></BottomBar>);
export const spacer = () => renderToStaticMarkup(<BottomBar.Spacer/>);
`;

const stubs = {
  '@/features/auth': real('features/auth/model/permission.ts', 'can'),
  '@/shared/constants': real('shared/constants/routes.ts', 'ROUTES') + 'export const FEATURE={face:true};',
  '@/shared/lib':
    real('shared/lib/cn.ts', 'cn') +
    real('shared/lib/seatGeometry.ts', 'FULL_VENUE,STAGE_LINE_RATIO,seatSizeOf,viewBoxOf') +
    real('shared/lib/format.ts', 'formatDateTime'),
  '@/shared/components/ui':
    ['Button', 'Card', 'Badge', 'Skeleton'].map((name) =>
      real('shared/components/ui/' + name + '.tsx', name)).join('') +
    'export const Logo=()=> <span>TEACAT</span>;',
  '@/shared/components/common': 'export const EmptyState=({title})=> <p>{title}</p>;'
    + 'export const Loading=()=> <p>Loading</p>;',
  /* 명단 표는 회원 관리의 표 껍데기를 그대로 씁니다 — 배럴을 통째로 끌어오면 훅까지 따라옵니다 */
  '@/features/admin': real('features/admin/components/AdminRecordTable.tsx', 'AdminRecordTable'),
};

const bundle = await build({
  absWorkingDir: root,
  stdin: { contents: source, loader: 'tsx', resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  external: ['react', 'react-dom', 'react-dom/server', 'react-router-dom'],
  define: { 'process.env.NODE_ENV': '"test"' },
  plugins: [{ name: 'boundaries', setup(api) {
    api.onResolve({ filter: /^@\// }, ({ path }) => {
      if (path in stubs) return { path, namespace: 'fixture' };
      throw new Error('허용하지 않은 경계 import: ' + path);
    });
    api.onLoad({ filter: /.*/, namespace: 'fixture' },
      ({ path }) => ({ contents: stubs[path], loader: 'tsx', resolveDir: root }));
  }}],
});

const { createRequire } = await import('node:module');
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(
  createRequire(import.meta.url), module, module.exports);
const { model, geometry, sidebar, seatMap, standing, attendees, bottomBar, spacer } = module.exports;
const assert = (value, message) => { if (!value) throw new Error(message); };

/* ── 공용 좌석 자리 계산 (예매 좌석맵과 함께 씁니다) ────────── */
{
  const points = [{ x: 0, y: 0 }, { x: 63, y: 0 }, { x: 0, y: 63 }];
  // 🔴 고정 크기를 쓰면 간격이 넓은 도면에서 좌석이 점처럼 작아진다 — 간격의 70% 다
  const size = geometry.seatSizeOf(points);
  assert(Math.abs(size - 63 * 0.7) < 1e-9, 'seat size follows the real gap');
  assert(geometry.seatSizeOf([{ x: 0, y: 0 }]) === 20 * 0.7, 'single seat falls back');
  const view = geometry.viewBoxOf(points, size);
  // 무대 표시가 잘리지 않도록 위쪽에 띠만큼 여백이 더 있어야 한다
  assert(view.minY < view.minX, 'stage band adds extra room above the seats');
  assert(view.width >= 63 + size && view.height >= 63 + size, 'view box covers every seat');
  assert(geometry.viewBoxOf([], size) === geometry.FULL_VENUE, 'no seats falls back to the venue');
  console.log('PASS shared seat geometry (booking and operations maps)');
}

/* ── 메뉴 권한 ─────────────────────────────────────────────── */
for (const role of ['ADMIN', 'PERFORMANCE', 'STADIUM']) {
  const html = sidebar(role);
  // 서버가 ADMIN·PERFORMANCE 에게만 여는 조회다. STADIUM 에게 보이면 눌러도 403 인 메뉴가 된다
  assert(html.includes('href="/admin/seat-attendees"') === (role !== 'STADIUM'),
    role + ' seat-attendees permission');
  // 입장 확인과 나란한 별도 메뉴이고, 둘 다 공연 운영 묶음에 있다
  if (role !== 'STADIUM') {
    assert(html.includes('href="/admin/check-in"'), role + ' check-in still present');
    const group = html.indexOf('aria-label="공연 운영"');
    assert(group >= 0 && group < html.indexOf('href="/admin/seat-attendees"'),
      role + ' seat-attendees inside 공연 운영 group');
  }
  console.log('PASS ' + role + ' seat-attendees menu permission');
}

/* ── 구역 분류 ─────────────────────────────────────────────── */
const seat = (seatId, state, ticketId = null, number = seatId) => ({
  seatId, rowLabel: '1', seatNumber: number, seatX: number * 10, seatY: 10, state, ticketId,
});
const seatedArea = {
  areaId: 1, areaCode: 'A', saleType: 'SEATED', grade: 'VIP', price: 1000,
  areaX: 0, areaY: 0, width: 100, height: 100, capacity: 4, bookedCount: 2, checkedInCount: 1,
  seats: [seat(1, 'BOOKED', 1024), seat(2, 'CHECKED_IN', 1025), seat(3, 'AVAILABLE'), seat(4, 'HELD')],
};
/* 스탠딩에도 좌표 없는 가상 좌석 행이 있다 — 서버는 비워 보내지만 화면도 그리지 않아야 한다 */
const standingArea = {
  areaId: 2, areaCode: 'S', saleType: 'STANDING', grade: '스탠딩', price: 500,
  areaX: null, areaY: null, width: null, height: null,
  capacity: 300, bookedCount: 10, checkedInCount: 4,
  seats: [{ seatId: 9, rowLabel: null, seatNumber: 1, seatX: null, seatY: null, state: 'BOOKED', ticketId: 1 }],
};
const emptySeated = { ...seatedArea, areaId: 3, areaCode: 'B', seats: [] };

const areas = [seatedArea, standingArea, emptySeated];
assert(model.mappableAreas(areas).length === 1, 'only seated areas with seats are drawable');
assert(model.standingAreas(areas)[0].areaId === 2, 'standing areas picked by sale type');
// 🔴 좌석이 없는 좌석제 구역을 스탠딩으로 보면 엉뚱한 구역에 정원 안내가 붙는다
assert(!model.isStanding(emptySeated), 'empty seated area is not standing');
assert(model.checkInRatio(0, 0) === 0, 'no division by zero');
assert(model.checkInRatio(4, 1) === 0.25, 'check-in ratio');
assert(model.seatText({ areaCode: 'A', rowLabel: '3', seatNumber: 12 }) === 'A구역 3열 12번', 'seat text');
assert(model.seatText({ areaCode: 'S', rowLabel: null, seatNumber: null }) === 'S구역 스탠딩',
  'standing seat text');
assert(Object.keys(model.OPERATIONS_SEAT_FILL).length === 5
  && model.OPERATIONS_SEAT_LEGEND.length === 5, 'five seat states are covered');
console.log('PASS area classification, seat labels and legend coverage');

/* ── 좌석맵 ───────────────────────────────────────────────── */
const map = seatMap([seatedArea], 1025);
const rects = map.match(/<rect/g) ?? [];
// 좌석 4개 + 무대 밑줄 1개
assert(rects.length === 5, 'seat rect count: ' + rects.length);
assert(map.includes('fill-seat-selected'), 'checked-in seat uses its own fill');
assert(map.split('aria-disabled="true"').length - 1 === 2, 'seats without tickets are not openable');
assert(map.includes('scale-125'), 'selected seat is marked by size, not color');
assert(seatMap([standingArea], null).match(/<rect/g).length === 1,
  'standing virtual seats are never drawn');
console.log('PASS seat map states, ticket-only selection and standing exclusion');

/* ── 스탠딩 정원 ──────────────────────────────────────────── */
const standingHtml = standing([standingArea]);
assert(standingHtml.includes('300') && standingHtml.includes('S구역'), 'standing capacity shown');
assert(!standingHtml.includes('열') , 'standing panel shows no seat numbers');
assert(standing([]) === '', 'no standing panel without standing areas');
console.log('PASS standing area capacity panel');

/* ── 명단 ─────────────────────────────────────────────────── */
const row = (ticketId, status, checkedInAt) => ({
  ticketId, areaId: 1, areaCode: 'A', seatId: ticketId, rowLabel: '3', seatNumber: ticketId,
  holderName: '홍*동', holderNickname: '고양이집사', holderPhone: '010-****-5678',
  status, bookedAt: '2026-09-20T10:00:00', checkedInAt,
});
const table = attendees([row(1, 'CONFIRMED', null), row(2, 'CANCELLED', null),
  row(3, 'CONFIRMED', '2026-09-20T19:10:00')], 3);
// 🔴 서버가 가린 값을 그대로 그린다. 화면이 원본을 기대하면 마스킹이 화면 버그로 보인다
assert(table.includes('홍*동') && table.includes('010-****-5678'), 'masked values rendered as given');
assert(table.includes('예매 취소'), 'cancelled tickets stay in the list');
assert(table.split('미입장').length - 1 === 2 && table.includes('입장<'), 'check-in column');
assert(table.includes('aria-selected="true"'), 'selected row is marked');
console.log('PASS attendee rows, cancelled tickets and selection');

/* ── 하단 고정 버튼 (모바일 여백) ──────────────────────────── */
const fixed = bottomBar(false);
const inline = bottomBar(true);
/* 🔴 모바일 하단 여백은 컴포넌트가 지키는 값이다. 화면에서 pb 를 덮어쓰면 안드로이드
      (safe-area 0)에서 버튼이 화면 바닥에 붙는다 — BottomBar 주석 참고 */
assert(fixed.includes('pb-[calc(2rem+env(safe-area-inset-bottom))]'), 'mobile bottom padding kept');
assert(inline.includes('pb-[calc(2rem+env(safe-area-inset-bottom))]'), 'inline variant keeps mobile padding');
assert(!fixed.includes('lg:static') && inline.includes('lg:static'),
  'desktop inline variant is opt-in');
assert(inline.includes('fixed') && inline.includes('lg:p-0'), 'inline variant still fixed on mobile');
assert(spacer().includes('h-[calc(7.5rem+env(safe-area-inset-bottom))]'), 'spacer matches the bar');
console.log('PASS bottom action bar padding, safe area and desktop inline variant');
