// 스모크: 시나리오가 깨지지 않았는지 1 VU 로 30초만 돈다.
// 부하가 아니라 **점검**이다. ramp.js 를 돌리기 전에 항상 먼저 돌린다.
//
//   k6 run loadtest/k6/smoke.js

import { sleep } from 'k6';
import { home, concertDetail, scheduleDetail, market, fetchConcertIds, pick } from './lib/api.js';

export const options = {
    vus: 1,
    duration: '30s',
    thresholds: {
        // 스모크에서 실패가 하나라도 나면 시나리오나 서버가 잘못된 것이다
        http_req_failed: ['rate==0'],
        checks: ['rate==1'],
    },
};

export function setup() {
    return { concertIds: fetchConcertIds() };
}

export default function (data) {
    home();
    const scheduleIds = concertDetail(pick(data.concertIds));
    if (scheduleIds.length > 0) scheduleDetail(pick(scheduleIds));
    market();
    sleep(1);
}
