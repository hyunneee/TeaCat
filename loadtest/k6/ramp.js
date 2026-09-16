// 계단식 부하: 10 → 30 → 60 → 100 VU 로 올리며 어디서 무너지는지 본다.
//
//   k6 run loadtest/k6/ramp.js
//   k6 run -e MAX_VUS=50 loadtest/k6/ramp.js        # 정점을 낮춰서
//
// 🔴 개발 서버는 운영과 같은 EC2 에 있다. 돌리는 동안 Grafana(https://dev.teacat.site/dashboard)에서
//    **운영** p95 와 node CPU 를 같이 본다. 운영 p95 가 평소 2배를 넘으면 Ctrl+C 로 바로 끊는다.
//    README.md 의 체크리스트를 먼저 읽을 것.

import { sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { home, concertDetail, scheduleDetail, market, fetchConcertIds, pick } from './lib/api.js';

const MAX = Number(__ENV.MAX_VUS || 100);

export const options = {
    scenarios: {
        browse: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '1m', target: Math.min(10, MAX) },
                { duration: '2m', target: Math.min(30, MAX) },
                { duration: '2m', target: Math.min(60, MAX) },
                { duration: '2m', target: MAX },
                { duration: '30s', target: 0 },
            ],
            gracefulRampDown: '15s',
        },
    },
    thresholds: {
        // 🔴 abortOnFail: 기준을 넘으면 k6 가 스스로 멈춘다. 운영을 보호하는 마지막 장치다.
        //    delayAbortEval 은 램프업 초반의 콜드스타트 튐을 무시하는 유예 시간.
        http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '30s' }],
        http_req_duration: [
            { threshold: 'p(95)<800', abortOnFail: true, delayAbortEval: '1m' },
            'p(99)<2000',
        ],
        // 엔드포인트별 기준. 어느 API 가 먼저 느려지는지 요약에서 바로 보인다
        'http_req_duration{name:GET /concerts}': ['p(95)<800'],
        'http_req_duration{name:GET /concerts/{id}}': ['p(95)<500'],
        'http_req_duration{name:GET /schedules/{id}/booking-status}': ['p(95)<500'],
        'http_req_duration{name:GET /banners}': ['p(95)<500'],
    },
    summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
    return { concertIds: fetchConcertIds() };
}

// 실제 사용자 흐름을 흉내낸다: 홈 → 상세 (→ 회차) → 가끔 마켓. 화면 사이에 1~3초 머문다.
export default function (data) {
    home();
    sleep(1 + Math.random() * 2);

    const scheduleIds = concertDetail(pick(data.concertIds));
    sleep(1 + Math.random() * 2);

    if (scheduleIds.length > 0) {
        scheduleDetail(pick(scheduleIds));
        sleep(1 + Math.random());
    }

    if (Math.random() < 0.3) {
        market();
        sleep(1);
    }
}

// 결과를 results/ 에 남긴다 (gitignore). 콘솔 요약은 그대로 나온다.
export function handleSummary(data) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return {
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
        [`loadtest/k6/results/ramp-${stamp}.json`]: JSON.stringify(data, null, 2),
        [`loadtest/k6/results/ramp-${stamp}.txt`]: textSummary(data, { indent: ' ', enableColors: false }),
    };
}
