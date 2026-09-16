# k6 부하테스트 (개발 서버)

`dev.teacat.site` 의 **비로그인 GET API** 만 친다. 쓰기 API 는 없다.

## 🔴 돌리기 전에

개발 서버는 운영과 **같은 EC2(t3.xlarge, 4 vCPU) 한 대**에 있다. 부하가 운영으로 번지는
경로가 셋이다: CPU, 디스크 I/O(postgres 둘이 같은 NVMe), nginx(하나).

1. **개발 컨테이너에 CPU 상한이 걸려 있는지** 확인한다. `docker/docker-compose.dev.yml` 의
   `cpus:` 가 배포된 상태여야 한다 (`docker inspect dev-server --format '{{.HostConfig.NanoCpus}}'`
   가 `1500000000`). 0 이면 아직 옛 compose 로 떠 있는 것이다.
2. **운영 트래픽이 적은 시간**에 한다. 새벽이 안전하다.
3. **Grafana 를 옆에 켠다**: <https://dev.teacat.site/dashboard>. 운영 서버 p95 와 node CPU 패널을 본다.
4. **중단 기준**을 정해 둔다. 운영 p95 가 평소의 2배, 또는 node CPU 90% 이상 1분 지속이면 `Ctrl+C`.
   k6 자체도 개발 p95 800ms · 실패율 1% 를 넘으면 스스로 멈춘다 (`abortOnFail`).
5. **부하 생성기는 EC2 밖에서** 돌린다. 본인 PC 면 된다. EC2 안에서 돌리면 k6 가 먹는 CPU 가
   결과를 왜곡하고 운영도 같이 느려진다.

## 설치

```bash
winget install k6 --source winget
```

또는 Docker 로 (설치 없이):

```bash
docker run --rm -i -v "${PWD}:/work" -w /work grafana/k6 run loadtest/k6/ramp.js
```

## 실행

항상 스모크부터. 1 VU 30초로 시나리오가 깨지지 않았는지만 본다.

```bash
k6 run loadtest/k6/smoke.js
```

통과하면 계단식 부하. 10 → 30 → 60 → 100 VU, 약 7분 30초.

```bash
k6 run loadtest/k6/ramp.js
```

정점을 낮추려면:

```bash
k6 run -e MAX_VUS=50 loadtest/k6/ramp.js
```

### 좌석 페이지 체류 (사용자 수를 직접 잰다)

좌석 선택 화면은 `/schedules/{id}/seats` 를 3초마다 폴링한다. 이 시나리오는 VU 하나가 그 주기를 그대로
따르므로 **VU 수 = 좌석 페이지에 머무는 사용자 수** 다. 사용자 N 명 ≈ N/3 req/s.

```bash
k6 run -e USERS=600 loadtest/k6/seatmap-poll.js
```

`HOLD`(기본 90s)는 60초 이상이어야 한다. nginx 의 TIME_WAIT(60초)가 정상 상태에 도달해야 진짜 소켓 수가 보인다.

2026-09-16 측정 (dev-server cpus=1.5, 좌석 약 19KB 응답, nginx keepalive 없음):

| 사용자 | 서버 처리 req/s | 클라 p95 | 서버 p95 | busy 스레드 (max 200) | Hikari active / 대기 (max 10) | 커넥션 대기 최대 | JVM CPU | 실패 |
|---|---|---|---|---|---|---|---|---|
| 300 | 99 | 43ms | 14ms | 1 | 1 / 0 | 30ms | 46% | 0 |
| 600 | 197 | 99ms | 47ms | 2 | 3 / 0 | 147ms | 73% | 0 |
| 900 | 287 | 494ms | 442ms | 94 | **10 / 83** | 1.9s | 98% | 0 |
| 1200 | 325 | 1.73s | 1.34s | **200** | 10 / 188 | 4.2s | 100% | 0 |
| 1800 | 316 | 3.89s | 1.76s | 200 | 10 / 191 | 4.8s | 100% | 0 |
| 2400 | 274 | 7.08s | 2.05s | 200 | 10 / 190 | 4.6s | 100% | **4.0% (10초 타임아웃)** |

- busy 스레드 = 처리 중 요청 수(`http_server_requests_active_seconds_gcount`). 톰캣은 요청당 스레드 하나라 같다.
  `tomcat_threads_*` 는 `server.tomcat.mbeanregistry.enabled=true` 가 없어 노출되지 않는다.
- 병목 순서: **Hikari 10개 (900명)** → 커넥션 기다리는 요청이 스레드를 잡아 **톰캣 200 (1200명)** → accept 큐 대기 → 10초 타임아웃(2400명).
  서버는 5xx 를 한 번도 내지 않았고 nginx 에러도 없었다. "터지는" 형태는 크래시가 아니라 큐 대기다.
- 서버 처리량 상한 약 320 req/s. 그 위로는 사용자를 늘려도 대기만 길어진다.
- 2400 명에서 nginx 동시 연결이 3,700 개. `worker_connections 1024 × 4` = 4,096 이 운영과 공용이라 **3,000 명 위로는 운영 nginx 까지 연결을 거부한다.** 그래서 여기서 멈췄다.

2026-09-16 좌석맵 1초 캐시(Caffeine, S15P21A402-186) 적용 후 재측정. 같은 조건(cpus=1.5, 90초 유지):

| 사용자 | 서버 처리 req/s | 클라 p95 | 서버 p95 | busy 스레드 | Hikari active / 대기 | JVM CPU | 실패 | nginx |
|---|---|---|---|---|---|---|---|---|
| 600 | 183 | 69ms | **9.7ms** | 3 | **0 / 0** | 88%→43% | 0 | TIME_WAIT 12,400 |
| 1200 | 357 | 1.41s | 13ms | 1 | 0 / 0 | 46% | 0 | TIME_WAIT 22,000 · CPU 290% |
| 1800 | 419 | 3.43s | 22ms | 2 | 0 / 0 | 64% | **1.25%** | TIME_WAIT **27,949** · 502 ×132 |

- 캐시 히트는 DB 커넥션을 잡지 않아 Hikari 가 0 에 머문다. 서버 p95 는 1200 명에서 1.34s → 13ms (100배).
- 병목이 **nginx 로 옮겨갔다.** 클라 p95 와 서버 p95 의 차이가 전부 nginx 다. 1800 명(420 req/s)에서 임시 포트
  28,232 개가 고갈되어 `connect() failed (99: Cannot assign requested address)` → 502. 운영 응답도 0.3~0.7s 로 튀었다.
- 해결은 `docker/nginx/conf.d/dev.conf` 의 upstream keepalive (같은 날 반영). 반영 후 다시 재면 서버의 진짜 한계가 보인다.

## 결과 읽는 법

콘솔 요약과 함께 `results/ramp-<시각>.{json,txt}` 가 남는다 (gitignore).

- `http_req_duration` 의 `p(95)` 가 핵심이다. VU 를 올려도 이 값이 평평하면 여유가 있는 것이고,
  어느 단계에서 꺾이면 그 VU 수가 개발 서버의 한계다.
- `http_req_duration{name:…}` 줄로 **어느 API 가 먼저 느려지는지** 본다. 보통 목록(`GET /concerts`)이나
  Redis 를 타는 `booking-status` 가 먼저다.
- `http_req_failed` 가 0 이 아니면 어떤 상태코드였는지 `checks` 의 실패 줄에서 본다.
  502/504 는 nginx 가 dev-server 에 못 붙은 것이고, 500 은 서버 예외다. 후자는 dev-server 로그를 본다.
- 🔴 이 수치는 "운영과 자원을 나눠 쓰는 상태의 개발 서버" 성능이다. 운영 단독 용량과는 다르다.
  운영 용량이 필요하면 임시 인스턴스를 하나 띄워 거기서 재는 게 맞다.

## 시나리오 구성

`lib/api.js` 가 엔드포인트와 응답 검사를 갖고 있고, 두 스크립트가 같은 흐름을 쓴다.

| 화면 | 엔드포인트 |
|---|---|
| 홈 | `/banners`, `/concerts`, `/concerts/upcoming-open` |
| 공연 상세 | `/concerts/{id}`, `/{id}/schedules`, `/{id}/areas`, `/{id}/policy` |
| 회차 | `/schedules/{id}`, `/schedules/{id}/booking-status` |
| 마켓 (30%) | `/nft-market/photocards`, `/nft-market/auctions` |

공연 ID 는 `setup()` 에서 `/concerts` 로 받아 온다. 화면 사이에 1~3초 쉰다.

쓰기 API 를 넣고 싶으면 `lib/api.js` 상단 주석을 먼저 읽을 것. 좌석 선점·결제·포카 뽑기는
dev-postgres 와 dev-blockchain 에 데이터를 남기고, 뽑기는 실제 체인 트랜잭션을 만든다.
