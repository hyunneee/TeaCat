// 좌석 선택 화면 체류 시나리오: "N 명이 좌석 페이지에 머무르면 버티는가".
//
// 클라이언트(useSeatMap.ts)는 /schedules/{id}/seats 를 3초마다 폴링한다.
// VU 하나가 그 주기를 그대로 따르므로 **VU 수 = 좌석 페이지에 머무는 사용자 수** 다.
// 사용자 N 명 ≈ N/3 req/s. 예: 600 명 = 200 req/s.
//
//   k6 run -e USERS=300 loadtest/k6/seatmap-poll.js            # 300 명, 90초 유지
//   k6 run -e USERS=600 -e HOLD=2m loadtest/k6/seatmap-poll.js
//
// 🔴 유지 시간은 60초 이상이어야 의미가 있다. nginx 가 dev-server 로 요청마다 새 TCP 연결을 열어
//    TIME_WAIT(60초)가 쌓이는데, 60초를 넘겨야 정상 상태(steady state)의 소켓 수가 보인다.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { API, fetchConcertIds, pickIds, pick } from './lib/api.js';

const USERS = Number(__ENV.USERS || 300);
const HOLD = __ENV.HOLD || '90s';
const POLL_SEC = 3; // useSeatMap refetchInterval: 3000
// 🔴 NO_ABORT=1 이면 기준을 넘어도 멈추지 않는다. "어디서 터지는가"를 끝까지 보려는 용도.
//    운영과 같은 EC2 라는 점을 잊지 말 것 — 운영 응답을 옆에서 보면서만 쓴다.
const ABORT = !__ENV.NO_ABORT;

export const options = {
    // 🔴 응답 본문을 버린다. 좌석맵은 19KB 라 VU 수천 명이면 k6 가 초당 수십 MB 를 파싱·보관하느라
    //    먼저 죽는다 (EC2 에서 1GB 한도로 1800 명에 OOM). 상태코드만 검사해도 "서버가 버티는가" 는 잰다.
    //    setup() 은 회차를 고르느라 본문이 필요해서 요청마다 responseType: 'text' 로 되살린다.
    discardResponseBodies: true,
    scenarios: {
        seat_page: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '20s', target: USERS }, // 입장
                { duration: HOLD, target: USERS },  // 체류
                { duration: '10s', target: 0 },     // 이탈
            ],
            gracefulRampDown: '5s',
        },
    },
    thresholds: {
        // 좌석맵은 19KB 짜리 응답이라 목록 API 보다 기준을 느슨하게 둔다.
        // 폴링 주기(3초)의 1/3 을 넘으면 화면이 눈에 띄게 늦게 갱신된다.
        http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: ABORT, delayAbortEval: '40s' }],
        'http_req_duration{name:GET /schedules/{id}/seats}': [
            { threshold: 'p(95)<1000', abortOnFail: ABORT, delayAbortEval: '40s' },
            'p(99)<2000',
        ],
    },
    summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

/** 좌석이 실제로 있는 회차만 고른다 (응답 1KB 미만은 좌석 미생성) */
export function setup() {
    const scheduleIds = [];
    for (const cid of fetchConcertIds()) {
        const res = http.get(`${API}/concerts/${cid}/schedules`, { tags: { name: 'setup' }, responseType: 'text' });
        for (const sid of pickIds(res, 'scheduleId')) {
            const seats = http.get(`${API}/schedules/${sid}/seats`, { tags: { name: 'setup' }, responseType: 'text' });
            if (seats.status === 200 && seats.body.length > 1000) scheduleIds.push(sid);
        }
    }
    if (scheduleIds.length === 0) throw new Error('setup: 좌석이 생성된 회차가 없다');
    console.log(`좌석맵 대상 회차 ${scheduleIds.length}개: ${scheduleIds.join(', ')} · 사용자 ${USERS}명 · 체류 ${HOLD}`);
    return { scheduleIds };
}

export default function (data) {
    // VU 마다 회차 하나를 고정한다. 실제 사용자는 한 회차 화면에 머무른다
    const sid = data.scheduleIds[__VU % data.scheduleIds.length];

    // 첫 진입에만 회차 정보를 받는다 (useSchedule). 이후는 폴링만
    if (__ITER === 0) {
        const s = http.get(`${API}/schedules/${sid}`, { tags: { name: 'GET /schedules/{id}' } });
        check(s, { 'schedule 200': (r) => r.status === 200 });
    }

    const res = http.get(`${API}/schedules/${sid}/seats`, {
        tags: { name: 'GET /schedules/{id}/seats' },
        timeout: '10s',
    });
    // 본문은 버렸으므로(discardResponseBodies) 상태코드만 본다. 본문 검사는 smoke.js 가 한다
    check(res, { 'seats 200': (r) => r.status === 200 });

    // TanStack 은 응답을 받은 뒤 3초 후 다시 요청한다
    sleep(POLL_SEC);
}

export function handleSummary(data) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const base = `loadtest/k6/results/seatmap-${USERS}u-${stamp}`;
    return {
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
        [`${base}.json`]: JSON.stringify(data, null, 2),
        [`${base}.txt`]: textSummary(data, { indent: ' ', enableColors: false }),
    };
}
