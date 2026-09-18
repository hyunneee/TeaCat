# 회원가입 지갑 발급을 RabbitMQ 로 비동기화

> 이슈 S15P21A402-194 · 2026-09-18 · 측정 환경 dev.teacat.site

## 1. 배경

티캣은 가입하는 순간 회원에게 블록체인 지갑을 만들어 주고 가입 축하금 1,500 CAT 을 발행한다.
지갑 주소 파생과 민팅 트랜잭션 제출은 마스터 니모닉을 쥔 별도 Node.js 서비스(blockchain)가 맡고,
Spring 서버는 이를 `POST /internal/wallets` 로 부른다.

기존 구조에서는 이 HTTP 호출이 **가입 DB 트랜잭션 안에서 동기로** 일어났다.

```
가입 요청 → users INSERT → (같은 트랜잭션) HTTP → blockchain → 주소 파생 + mint 제출 → 응답 저장 → 커밋 → 201
```

이 구조는 "지갑 없는 회원이 남지 않는다" 는 장점이 있었지만 세 가지 비용이 있었다.

| 문제 | 원인 |
|---|---|
| 가입 응답이 체인 서비스 속도에 묶인다 | HTTP 왕복(RPC 조회 + 트랜잭션 제출)이 응답 시간에 그대로 더해진다 |
| 동시 가입이 줄을 선다 | blockchain 서비스는 오퍼레이터 지갑 하나의 논스를 프로세스 안에서 한 줄로 직렬화한다. 동시 가입 N건 = N번 대기 |
| 체인 서비스 장애가 가입 장애가 된다 | 컨트랙트 주소 누락, 노드 다운, 타임아웃(20초)이 모두 가입 실패로 나타난다. 그동안 DB 커넥션도 물고 있다 |

## 2. 목표와 비목표

**목표**

- 가입 응답 시간을 체인 서비스와 분리한다.
- 체인 서비스가 죽어 있어도 가입은 되고, 복구되면 지갑이 자동으로 만들어진다.
- 개선 폭을 같은 조건에서 **측정해 숫자로 남긴다.**

**비목표**

- blockchain 서비스는 바꾸지 않는다. REST 그대로 두고 멱등성만 활용한다.
- 다른 체인 호출(충전, 티켓, NFT)은 이번 범위에 넣지 않는다. 이들은 이미 "DB 상태 + 스케줄러" 로 비동기화되어 있다.

## 3. 설계

### 3-1. 흐름

```
가입 요청 → users INSERT + wallet_provisions(PENDING) INSERT → 커밋 → 201
                                                              └─(AFTER_COMMIT)→ RabbitMQ
RabbitMQ → Spring 소비자 → ① 파생 인덱스 확보(DB) → ② HTTP blockchain → ③ 지갑 기록 + DONE(DB)
스위퍼(30초) → 30초 넘게 PENDING 인 행 → RabbitMQ 로 다시
```

### 3-2. 원칙

**큐는 신호, 진실은 DB 행.**
메시지에는 `provisionId` 하나만 실린다. 소비자는 그 id 로 행을 다시 읽는다. 메시지가 사라지거나 브로커가 죽어도
`wallet_provisions` 의 PENDING 행이 남아 있으므로 스위퍼가 다시 보낸다. 재시도 경로는 스위퍼 하나뿐이다.

**메시지는 커밋 뒤에만 나간다.**
가입 트랜잭션 안에서 `RabbitTemplate` 을 부르면 롤백된 회원의 메시지가 큐에 남아 **없는 회원에게 지갑을 만들고 1,500 CAT 을 주인 없는 주소로 보낸다.**
스프링 이벤트 + `@TransactionalEventListener(AFTER_COMMIT)` 로 발행 시점을 커밋 뒤에 고정했다.
발행 실패는 예외로 올리지 않는다. 가입은 이미 됐고 스위퍼가 다시 보낸다.

**파생 인덱스를 체인 호출 전에 DB 에 저장한다.**
소비자가 시도마다 새 인덱스를 뽑으면, 체인 호출 뒤 서버가 죽었을 때 다음 시도가 다른 주소로 다시 민팅한다.
첫 시도에서 시퀀스로 뽑은 인덱스를 행에 먼저 저장하고 나서 체인을 부르므로, 재시도는 같은 인덱스로 가고
blockchain 서비스가 `ALREADY_DONE` 으로 답한다. 시드가 두 번 나가지 않는다.

**`user_id` UNIQUE + 행 잠금.**
RabbitMQ 는 최소 한 번 전달이고, 블루그린 전환 중에는 두 색이 같은 큐를 함께 소비한다.
같은 메시지를 두 소비자가 집어도 `SELECT … FOR UPDATE` 로 한쪽이 끝날 때까지 기다리고, 기다린 쪽은 DONE 을 보고 물러난다.

**실패 메시지는 재큐잉하지 않고 DLQ 로.**
RabbitMQ 의 기본 동작은 nack 된 메시지를 즉시 큐 앞으로 되돌리는 것이다. 체인 서비스가 죽어 있으면 같은 메시지가 초당 수십 번 돌며
다른 메시지까지 막는다. `default-requeue-rejected: false` 와 DLX 로 실패 메시지는 `wallet.provision.dlq` 에 쌓이고,
재시도 간격은 스위퍼의 `retry-after`(30초)가 정한다. DLQ 는 기록용이며 자동으로 다시 꺼내지 않는다.

**체인 호출은 트랜잭션 밖에서.**
소비자의 DB 작업은 ①과 ③ 두 개의 짧은 트랜잭션이고, ② HTTP 호출은 그 사이에서 트랜잭션 없이 일어난다. 가입 때와 같은 이유다.

### 3-3. 새 상태: "지갑 준비 중"

지갑이 준비될 때까지(보통 1초 안) "지갑 없는 회원" 이 잠깐 존재한다.
기존의 `WALLET_003`(지갑 없음, 404, 고객센터 안내)과 구분하기 위해 **`WALLET_010`(지갑 준비 중, 409)** 을 추가했다.
지갑 조회가 실패하면 `wallet_provisions` 를 보고 PENDING 이면 010, 행조차 없으면 003 을 낸다.
프론트는 010 을 받으면 잠시 뒤 재시도하면 된다.

## 4. 변경 사항

### 4-1. 인프라 (`56ad6a4`)

| 파일 | 내용 |
|---|---|
| `docker/docker-compose.dev.yml`, `docker-compose.prod.yml` | `rabbitmq:4-management-alpine` 서비스, 볼륨, healthcheck. server 가 healthy 를 기다림. `SPRING_RABBITMQ_*` 주입. 관리 UI 는 외부에 열지 않음 |
| `docker/.env.dev.example`, `.env.prod.example` | `RABBITMQ_USER`, `RABBITMQ_PASSWORD` |
| `Jenkinsfile` | 운영 블루그린 1단계 인프라 기동 목록에 `rabbitmq` 추가 |
| `server/build.gradle` | `spring-boot-starter-amqp` |
| `application.yaml` | 로컬 접속 기본값, `default-requeue-rejected: false` |
| `common/config/RabbitConfig.java` | 익스체인지 `teacat.wallet`, 큐 `wallet.provision`(DLX 지정), DLQ `wallet.provision.dlq`, JSON 변환기 |

### 4-2. 서버 (`7cb246f`)

| 파일 | 역할 |
|---|---|
| `db/migration/V20260918_1000__add_wallet_provisions.sql` | `wallet_provisions` 테이블. `user_id` UNIQUE, `derivation_index` UNIQUE(nullable), `attempts`, `last_error`, `provisioned_at`. 기존 회원은 DONE 으로 백필 |
| `wallet/entity/WalletProvision`, `WalletProvisionStatus` | 엔티티. `assignDerivationIndex` 는 한 번만 허용 |
| `wallet/repository/WalletProvisionRepository` | `findByIdForUpdate`(PESSIMISTIC_WRITE), 스위퍼용 PENDING 조회 |
| `wallet/service/WalletService` | `provision(user)` → `requestProvision(user)`. PENDING 행 저장 + 이벤트 발행. 체인 의존 제거. `walletMissing(userId)` 로 003/010 구분 |
| `wallet/service/WalletProvisionRecorder` | DB 단계 셋: `claimDerivationIndex`, `complete`, `recordFailure`. 각각 짧은 트랜잭션 |
| `wallet/service/WalletProvisioner` | 한 건을 끝까지: 인덱스 확보 → 체인 호출(트랜잭션 밖) → 지갑 기록. `NOT_SUPPORTED` |
| `wallet/service/WalletProvisionSweeper` | 30초마다 오래 PENDING 인 행을 다시 발행 |
| `wallet/messaging/WalletProvisionMessage` | 큐 메시지. `provisionId` 만 |
| `wallet/messaging/WalletProvisionRequestedEvent` | 가입 트랜잭션 안에서 발행되는 스프링 이벤트 |
| `wallet/messaging/WalletProvisionPublisher` | `AFTER_COMMIT` 에 발행. 실패는 warn 만 |
| `wallet/messaging/WalletProvisionListener` | `@RabbitListener`. 실패 시 `AmqpRejectAndDontRequeueException` |
| `common/config/WalletProvisioningProperties` | `retry-after 30s`, `sweep-interval PT30S`, `sweep-batch-size 50`, `sweep-enabled` |
| `auth/service/AuthService`, `OauthService`, `user/service/AdminUserService` | `requestProvision` 호출로 교체 |
| `wallet/exception/WalletErrorCode` | `WALLET_010` 추가 |
| `wallet/service/CatMoneyService` | 지갑 조회 실패 시 `walletMissing` 사용 |
| `test/.../WalletProvisioningIntegrationTests` | 7개. 아래 4-3 |
| `test/.../support/PostgresIntegrationTest` | 테스트에서 스위퍼·리스너 끔 (브로커 없음) |

### 4-3. 테스트

`WalletProvisioningIntegrationTests` (Postgres 컨테이너, `RabbitTemplate`·`BlockchainWalletClient` 스텁)

1. 가입은 지갑을 만들지 않고 발급 요청만 남긴다
2. 가입이 커밋되면 메시지가 나간다 (`convertAndSend` 호출 검증)
3. 요청을 처리하면 지갑이 생기고 DONE 이 된다. 지갑의 파생 인덱스 = 요청 행에 먼저 저장된 값
4. 같은 요청을 두 번 처리해도 지갑은 하나, 체인 호출은 한 번
5. 체인이 실패하면 PENDING 으로 남고(`attempts=1`, `last_error`), 다음 시도는 **같은 인덱스**를 쓴다
6. 지갑이 준비되기 전에는 `WALLET_010`, 준비 뒤에는 지갑을 돌려준다
7. 발급 요청조차 없는 회원은 `WALLET_003`

서버 전체 테스트 402개 통과. 실제 브로커 연결은 dev 배포 후 확인했다 (6장).

### 4-4. 측정 스크립트 (`db6db51`)

`scripts/bench/signup-latency.mjs`. Node 만 있으면 돈다. 실제 회원을 만들므로 dev 전용.

| 구간 | 무엇을 재나 |
|---|---|
| 가입 순차 | 한 건씩 30건. 기준값 |
| 가입 응답 → 지갑 준비 | 가입 직후 로그인해 잔액 조회가 409(`WALLET_010`)를 벗어나는 첫 응답까지. 로그인 왕복 포함 |
| 가입 동시 10건 × 3회 | 직렬화 병목이 만드는 꼬리 |
| 가입 중복 409 | 같은 엔드포인트가 체인을 타지 않을 때. 네트워크 + 프레임워크 바닥값 |
| 로그인 | bcrypt + DB. 체인 없는 쓰기 경로 대조군 |

```bash
node scripts/bench/signup-latency.mjs --label before --seq 30 --conc 10 --waves 3 --controls 20
node scripts/bench/signup-latency.mjs --label after  --seq 30 --conc 10 --waves 3 --controls 20
```

결과는 `scripts/bench/results/<label>-<시각>.json` 에 원시 샘플까지 남는다.

## 5. 결과

dev.teacat.site, 같은 PC, 같은 파라미터. 단위 ms, 클라이언트 왕복(TLS·네트워크 포함).

| 구간 | before p50 | after p50 | before p95 | after p95 | before max | after max |
|---|---|---|---|---|---|---|
| **가입 순차** | 245 | **108** | 327 | **157** | 602 | 269 |
| **가입 동시 10건 × 3** | 1102 | **613** | 1446 | **748** | 1489 | 749 |
| 가입 응답 → 지갑 준비 | 0 (동기) | 292 | 0 | 342 | 0 | 352 |
| 가입 중복 409 (대조군) | 27 | 17 | 36 | 22 | 40 | 22 |
| 로그인 (대조군) | 113 | 102 | 172 | 112 | 197 | 113 |

### 5-1. 해석

**순차 가입 p50 245 → 108ms (−56%).** after 의 가입(108ms)은 로그인(102ms)과 거의 같다.
가입 경로에서 체인 몫이 완전히 빠지고 bcrypt 와 DB 쓰기만 남았다는 뜻이다.
before 에서 체인 몫은 245 − 27(바닥) − 85(bcrypt) ≈ **130ms** 였다.

**지갑은 가입 응답 뒤 약 0.3초에 준비된다.** 30건 모두 첫 시도에 성공했고 재시도로 넘어간 건은 없다.
이 수치에 로그인 왕복 100ms 가 들어 있으므로 큐 경로 자체는 200ms 안쪽이다.
"응답만 빨라진 것이 아니라 지갑도 제때 생긴다" 를 보이는 항목이며, 비동기화의 비용을 숨기지 않기 위해 함께 적는다.

**동시 10건 p95 1446 → 748ms (−48%). 그러나 평평해지지는 않았다.**
체인 직렬화가 병목이었다면 동시 건수와 무관하게 순차와 비슷해져야 하는데 613ms 로 순차의 6배다.
원인은 **bcrypt** 다. 서버 컨테이너는 CPU 1.5개 상한이고 bcrypt 한 번이 약 85ms 의 CPU 를 쓴다.
10건이 동시에 들어오면 CPU 를 나눠 쓰느라 마지막 요청이 600~750ms 까지 밀린다.
첫 병목(체인 직렬화)이 사라지자 그다음 병목(CPU 바운드 해시)이 드러난 것이다.

**대조군이 각 10ms 정도 빨라졌다.** 두 실행 사이의 네트워크 상태 차이다. 개선폭에서 그만큼은 빼고 봐야 한다.

### 5-2. 한 줄 요약

> 가입 응답에서 블록체인 호출을 떼어 RabbitMQ 로 넘기고, 가입 p50 245→108ms, 동시 10건 p95 1446→748ms 를 같은 스크립트로 측정했다.
> 지갑은 응답 뒤 약 0.3초에 준비되며 첫 시도 성공률 100%. 남은 동시 요청 꼬리는 체인이 아니라 CPU 상한 아래의 bcrypt 다.

## 6. 운영

**배포 전 필수.** EC2 의 `~/teacat/.env.dev`, `~/teacat/.env.prod` 에 아래 두 줄. 없으면 compose 파싱에서 배포가 멈춘다.

```bash
printf 'RABBITMQ_USER=teacat\nRABBITMQ_PASSWORD=%s\n' "$(openssl rand -base64 24)" >> ~/teacat/.env.dev
```

비밀번호는 브로커 볼륨을 처음 만들 때 계정으로 굳는다(Postgres 와 같음). 이후 바꾸려면 볼륨을 지우거나 `rabbitmqctl change_password`.

**배포 후 확인.**

```bash
docker logs dev-server --since 2m 2>&1 | grep -E "지갑 발급 요청|지갑 발급 완료|지갑 발급에 실패"
docker exec dev-postgres psql -U teacat -d teacat -c \
  "SELECT status, count(*), max(provisioned_at - created_at) FROM wallet_provisions GROUP BY status"
```

"요청 → 완료" 가 1초 안에 이어지고 PENDING 이 0 이면 정상. `attempts` 가 쌓이는 행이 있으면 `last_error` 를 본다.

**장애 시 동작.**

| 상황 | 결과 |
|---|---|
| blockchain 서비스 다운 | 가입은 됨. 소비자 실패 → DLQ, 30초마다 스위퍼가 재시도. 복구되면 자동 처리. 그동안 해당 회원은 `WALLET_010` |
| RabbitMQ 다운 | 가입은 됨. 발행 실패는 warn. 브로커 복구 후 스위퍼가 재발행 |
| 소비자가 체인 호출 뒤 죽음 | 다음 시도가 같은 인덱스로 → blockchain 이 `ALREADY_DONE` → 지갑 기록만 이어서. 시드 중복 없음 |
| 블루그린 전환 중 두 색이 같은 메시지 소비 | 행 잠금으로 직렬화, 뒤쪽은 DONE 보고 물러남 |

## 7. 남은 과제

- **시드 확정 폴링.** `wallet_seed_grants.status` 는 여전히 `PENDING` 으로 남는다. txHash 로 확정을 확인하는 스케줄러는 이번 범위 밖(기존과 동일한 상태).
- **DLQ 가시성.** 지금은 쌓이기만 한다. 어드민 화면이나 알림(예: PENDING 5분 초과 건수 지표)이 있으면 좋다.
- **프론트의 `WALLET_010` 처리.** 가입 직후 잔액·결제 화면에서 잠시 뒤 재시도.
- **동시 가입 꼬리.** bcrypt 라운드 수 조정 또는 컨테이너 CPU 상한 상향이 다음 병목 해소 수단이다. 이번 변경의 범위는 아니다.
- **다른 체인 호출로 확장.** 충전·티켓·NFT 는 이미 DB 상태 + 스케줄러로 비동기화되어 있어 큐로 옮기면 얻는 것은 "폴링 주기 → 즉시" 와 다중 인스턴스 대비다. 처리량은 blockchain 서비스의 논스 직렬화가 상한이라 늘지 않는다.
