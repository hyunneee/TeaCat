// k6 시나리오가 함께 쓰는 것들 — 대상 주소, 공개 GET 엔드포인트, 응답 검사.
//
// 🔴 여기 있는 엔드포인트는 전부 **비로그인 GET** 이다 (SecurityConfig.PUBLIC_GET_ENDPOINTS).
//    쓰기 API 를 추가하려면 dev-postgres 와 dev-blockchain 에 데이터가 쌓인다는 걸 감안해야 한다.
//    특히 /photocards/draw, /payments/**, SEAT_PATH/hold 는 체인 트랜잭션·좌석 선점을 만든다.

import http from 'k6/http';
import { check } from 'k6';

// 기본은 개발. 운영을 치려면 BASE_URL 을 넘기되, 그 전에 README 의 주의사항을 읽을 것.
export const BASE_URL = __ENV.BASE_URL || 'https://dev.teacat.site';
export const API = `${BASE_URL}/api`;

// 요청마다 name 태그를 달아야 k6 요약이 URL 의 ID 를 하나로 묶어 준다.
// 안 달면 /concerts/27, /concerts/24 … 가 전부 다른 지표로 갈라진다.
function get(path, name) {
    const res = http.get(`${API}${path}`, {
        tags: { name },
        timeout: '30s',
    });
    check(res, {
        [`${name} 200`]: (r) => r.status === 200,
        // BaseResponse 규격. 200 인데 success=false 면 서비스 예외가 새는 것이다
        [`${name} success`]: (r) => {
            try { return r.json('success') === true; } catch (_) { return false; }
        },
    });
    return res;
}

/** 홈 화면 첫 로드: 배너 + 공연 목록 + 오픈 예정 */
export function home() {
    get('/banners', 'GET /banners');
    get('/concerts?size=20', 'GET /concerts');
    get('/concerts/upcoming-open', 'GET /concerts/upcoming-open');
}

/** 공연 상세 화면: 상세 + 회차 + 구역 + 정책 */
export function concertDetail(concertId) {
    get(`/concerts/${concertId}`, 'GET /concerts/{id}');
    const schedules = get(`/concerts/${concertId}/schedules`, 'GET /concerts/{id}/schedules');
    get(`/concerts/${concertId}/areas`, 'GET /concerts/{id}/areas');
    get(`/concerts/${concertId}/policy`, 'GET /concerts/{id}/policy');
    return pickIds(schedules, 'scheduleId');
}

/** 회차 화면: 회차 상세 + 예매 상태(Redis 를 탄다) */
export function scheduleDetail(scheduleId) {
    get(`/schedules/${scheduleId}`, 'GET /schedules/{id}');
    get(`/schedules/${scheduleId}/booking-status`, 'GET /schedules/{id}/booking-status');
}

/** 포카 마켓 목록. 지금 dev 에는 비어 있어 가벼운 쿼리지만, 경로는 살아 있는지 본다 */
export function market() {
    get('/nft-market/photocards?size=20', 'GET /nft-market/photocards');
    get('/nft-market/auctions?size=20', 'GET /nft-market/auctions');
}

/** setup() 에서 한 번 부른다. 테스트가 돌 동안 돌려 쓸 공연 ID 목록을 가져온다 */
export function fetchConcertIds() {
    const res = http.get(`${API}/concerts?size=50`, { tags: { name: 'setup' } });
    if (res.status !== 200) {
        throw new Error(`setup: /concerts 가 ${res.status} 를 돌려줬다. 대상 주소를 확인하라 (${API})`);
    }
    const ids = res.json('data.concerts').map((c) => c.concertId);
    if (ids.length === 0) {
        throw new Error('setup: 공연이 하나도 없다. 상세 조회 시나리오를 돌릴 수 없다');
    }
    return ids;
}

/** 목록 응답에서 ID 컬럼만 뽑는다. 응답이 배열이 아니면 빈 배열 */
export function pickIds(res, field) {
    try {
        const data = res.json('data');
        if (!Array.isArray(data)) return [];
        return data.map((x) => x[field]).filter((v) => v != null);
    } catch (_) {
        return [];
    }
}

export function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
