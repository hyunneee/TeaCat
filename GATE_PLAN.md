# 현장 검표(게이트) 작업 계획

> **새 세션은 이 문서부터 읽으세요.** 그다음 `client/CLAUDE.md` 7장(생체정보 처리 규칙),
> `server/CLAUDE.md` 6장(개인정보·생체정보), `client/public/models/README.md`(모델 실측 규격)를 봅니다.
> 작성일 2026-09-16 · 얼굴 등록·본인확인이 완료된 직후

---

## 0. 한 줄 요약

**공연장 입구에서 관객 얼굴을 찍어 "이 회차 티켓 중 누구인가"를 찾아 입장시키는 어드민 화면과 그 API를 만든다.**
만들되 **스위치는 꺼서 올린다** — 지금 운영에 얼굴 입장 절차가 없기 때문이다.

---

## 1. 지금 무엇이 있고 무엇이 없나

전제를 먼저 맞춘다. **얼굴 AI는 이미 다 붙어 있다.** 새로 가져올 인식 모델은 없다.

| | 상태 |
|---|---|
| YuNet 검출 + SFace 128차원 임베딩 (onnxruntime-web 워커) | **완료** (`features/face/model/face.worker.ts`) |
| 품질 게이트 (거리·정면·선명도·밝기) | **완료** (`faceQuality.ts`) |
| 얼굴 등록 · 본인확인(1:1) · 삭제 API | **완료** (`/users/me/face*`) |
| `faces.embedding` · `tickets.face_embedding` (pgvector `vector(128)`) | **완료** |
| 카메라 · 가이드 UI · 재사용 가능한 배럴 export | **완료** (`features/face/index.ts`) |
| **현장 검표 API (1:N)** | **이번 작업** |
| **입장 기록 · 중복 입장 차단** | **이번 작업** |
| **어드민 게이트 화면** | **이번 작업** |
| 라이브니스(안티스푸핑) | 이번 작업 **아님** — 8장 |
| 기본 얼굴(`bootstrap-default`) 해소 | 이번 작업 **아님** — 2장 |
| 얼굴 벡터 온체인 저장 | **하지 않는다** — 2장 |

---

## 2. 먼저 못 박을 세 가지

### 2-1. 🔴 얼굴 벡터는 블록체인에 올리지 않는다

`TicketSBT.sol` 이 온체인에 두는 건 `tokenId` · `owner` · `everIssued` 뿐이고, 주석에
**"얼굴 벡터는 이 서비스로 오지도 않습니다"** 라고 적혀 있다. 이 계획은 그 설계를 그대로 따른다.

공용 체인에 올린 생체 특징값은 **영구히 지울 수 없다.** 탈퇴 시 생체정보를 즉시 파기한다고
고지해 두었는데(`server/CLAUDE.md` 6장), 체인에 복사본이 있으면 그 고지가 거짓이 된다.
대조는 Postgres 가 하고, 체인은 "이 티켓이 존재하며 양도되지 않았다"만 증명한다.

### 2-2. 🔴 지금 티켓은 전부 `bootstrap-default` 라 게이트가 자동으로 무해하다

가입 시 `Face.defaultFace()` — 사람과 무관한 균일 벡터에 `modelVersion = "bootstrap-default"` —
가 들어가고, 발권할 때 티켓으로 **복사**된다 (`Ticket.java:107`).

게이트 대조 쿼리는 `face_model_version = :modelVersion` 으로 후보를 거른다. 실제 얼굴의
모델 버전(`VITE_FACE_MODEL_VERSION`)과 `bootstrap-default` 는 다르므로, **현재 발권된 티켓은
후보에 하나도 들어오지 않는다.** 즉 게이트를 붙여도 운영 흐름이 바뀌지 않는다.

`Face.isSameModel` 주석이 노린 동작이 이것이다 — 잘못 통과시키는 게 아니라 "확인할 수 없음"으로 끝난다.

> 그래서 **기본 얼굴 정책은 이번에 건드리지 않는다.** 실제 입장 운영을 시작하는 시점에
> 5장(Phase 5)에서 다룬다.

### 2-3. 🔴 주석 처리로 막지 않는다 — 스위치 두 개

`shared/constants/features.ts` 가 명시적으로 금지한다:

> 주석 처리로 막지 마세요. (1) 되살릴 때 어디를 풀어야 하는지 아무도 모르고,
> (2) 주석 안의 코드는 타입 검사·린트를 안 받아 그사이 조용히 썩습니다.

게이트는 서버 컨트롤러 + 어드민 라우트 + 사이드바 + 화면에 걸친다. 주석으로 묶으면 다음에 켤 때 빠뜨린다.

| 어디 | 스위치 | 기본값 | 껐을 때 |
|---|---|---|---|
| 서버 | `gate.enabled` (`GATE_ENABLED` 환경변수) | `false` | `@ConditionalOnProperty` 로 **컨트롤러 빈이 뜨지 않음** → 404 |
| 클라이언트 | `FEATURE.gate` | `false` | 어드민 라우트 미등록 · 사이드바에서 사라짐 |

`FEATURE` 주석이 경고하듯 *"화면에서만 막는 것입니다. 서버 API 는 그대로 열려 있습니다."*
게이트는 남의 티켓을 1:N 으로 훑는 엔드포인트라 **서버도 반드시 함께 닫는다.**

서버 쪽은 이미 같은 패턴이 있다 — `NftPhotocardIssueScheduler` 의
`@ConditionalOnProperty(prefix = "nft.photocard.issue", name = "scheduler-enabled", ...)`,
`application.yaml` 의 `${NFT_PHOTOCARD_ISSUE_SCHEDULER_ENABLED:false}`.
**코드는 전부 컴파일되고 테스트도 돈다.** 켤 때는 환경변수 하나만 바꾸면 되고 재배포도 필요 없다.

---

## 3. 왜 기존 `/users/me/face/verify` 를 못 쓰나

| | 본인확인 (있음) | 현장 검표 (이번) |
|---|---|---|
| 요청하는 사람 | 관객 **본인** 토큰 | **직원(ADMIN)** 토큰 |
| 대조 방식 | 1:1 | **1:N** |
| 대조 대상 | `faces.embedding` (내 프로필 얼굴) | `tickets.face_embedding` (이 회차 티켓들) |
| 답 | 유사도 점수 | **누구인가** + 입장 처리 |
| 부작용 | 없음 (읽기만) | **상태가 바뀐다** (입장 기록) |
| 범위 | 자기 자신 | **한 회차로 제한해야 함** |

인증 주체도 쿼리도 부작용도 다르다. 같은 엔드포인트에 분기를 넣으면 "내 얼굴 확인"과
"남의 티켓 찾기"가 한 메서드 안에 섞인다. **새 도메인으로 분리한다.**

---

## 4. 설계

### 4-1. 패키지 — 새 도메인 `gate/`

`server/CLAUDE.md` 2장의 도메인 구조를 그대로 따른다.

```
com.teacat.server.gate/
├── controller/  AdminGateController
├── dto/
│   ├── request/   GateVerifyRequest
│   └── response/  GateVerifyResponse · GateSessionResponse
├── entity/      Admission · AdmissionMethod
├── exception/   GateErrorCode
├── repository/  AdmissionRepository · GateCandidateRepository
└── service/     GateVerifyService · GateAdmissionService
```

**왜 `ticket/` 안이 아닌가.** `AdminTicketController` 주석의 규칙은 *"데이터를 가진 쪽이
들고 있어야 한다"* 이다. 입장의 주 데이터는 새로 만드는 `admissions` 이고 티켓은 참조 대상이다.
게다가 `ticket` 은 "예매"를 다루는 도메인이라 입장 판정 로직이 들어가면 성격이 섞인다.

### 4-2. 스키마 — `admissions` 테이블 (`TicketStatus` 에 값을 더하지 않는다)

```sql
-- V20260916_XXXX__add_admissions.sql   (머지 직전에 시각을 최신으로 맞출 것 — 5장 규칙)
CREATE TYPE admission_method AS ENUM ('FACE', 'MANUAL');

CREATE TABLE admissions (
    id          BIGSERIAL PRIMARY KEY,
    ticket_id   BIGINT           NOT NULL REFERENCES tickets (id),
    admitted_at TIMESTAMP        NOT NULL DEFAULT now(),
    admitted_by BIGINT           NOT NULL REFERENCES users (id),
    method      admission_method NOT NULL,
    CONSTRAINT uq_admissions_ticket UNIQUE (ticket_id)
);
```

🔴 **`UNIQUE (ticket_id)` 가 중복 입장을 막는 유일한 근거다.** 서비스에서 `existsBy...` 로
먼저 확인하는 코드는 **동시 요청에서 뚫린다** — 게이트를 두 대 운영하면 같은 티켓이
두 기기에 동시에 들어올 수 있다. 애플리케이션 검사는 친절한 에러 메시지를 위해서만 두고,
**보장은 DB 제약이 한다.** 위반은 `DataIntegrityViolationException` 을 잡아
`GATE_002 ALREADY_ADMITTED` 로 변환한다.

**왜 `TicketStatus.ENTERED` 가 아닌가.**

1. `TicketStatus` 주석이 *"예매 자체의 상태다"* 라고 못 박고 있다. 입장은 예매 상태가 아니다.
2. 상태가 하나뿐이라 **"입장한 뒤 취소"를 표현할 수 없다.** `CONFIRMED → ENTERED` 로 가면
   취소 정보가 덮인다.
3. 기존 쿼리가 전부 `status` 로 거른다 (`countByUserIdAndPerformanceDetailIdAndStatus`,
   `countSoldByArea`, 1인 1매 검사 …). 값을 추가하면 **그 전부를 다시 봐야 한다.**
4. 입장 시각·통과시킨 직원·판정 방식을 남길 자리가 필요한데 enum 에는 없다.

🔴 **유사도 점수는 저장하지 않는다.** 생체 판정 점수라 남길 값이 아니다
(`useFaceVerify` 가 GA 에 점수를 안 보내는 것과 같은 이유). 남기는 건 누가·언제·어떤 방식뿐이다.

### 4-3. 대조 쿼리 — 임베딩을 JVM 으로 꺼내지 않는다

`Face.cosineSimilarityTo` 는 **1:1 전용**이다. 1:N 에 쓰면 회차 티켓 전부를 엔티티로 읽어야 하고,
그건 *"저장해 둔 임베딩을 밖으로 꺼내지 않는다"* 는 그 메서드의 존재 이유를 정면으로 깬다.

**pgvector 가 DB 안에서 계산한다.** 나가는 건 id 와 점수뿐이다.

```sql
SELECT t.id                                                AS ticket_id,
       1 - (t.face_embedding <=> CAST(:probe AS vector))   AS similarity
  FROM tickets t
 WHERE t.performance_detail_id = :performanceDetailId
   AND t.status                = 'CONFIRMED'
   AND t.face_embedding      IS NOT NULL
   AND t.face_model_version   = :modelVersion
   AND NOT EXISTS (SELECT 1 FROM admissions a WHERE a.ticket_id = t.id)
 ORDER BY t.face_embedding <=> CAST(:probe AS vector)
 LIMIT 2
```

- `<=>` 는 **코사인 거리**다. 유사도 = `1 - 거리`. 양쪽 다 L2 정규화된 벡터라 성립한다.
- `LIMIT 2` — **1등과 2등만 있으면 된다.** 2등은 마진 판정(4-5)에만 쓰고, 그 아래는 알 필요가 없다.
- `face_model_version` 필터가 `bootstrap-default` 티켓을 후보에서 통째로 빼낸다 (2-2).
- 이미 입장한 티켓은 `NOT EXISTS` 로 뺀다 — 안 빼면 먼저 들어간 사람이 계속 1등으로 잡혀
  뒤에 온 진짜 관객이 "이미 입장함"으로 막힌다.

**인덱스는 처음에 만들지 않는다.** HNSW(`vector_cosine_ops`)는 **근사 검색**이라 1등을 놓칠 수
있는데, 입장 통제에서 "가끔 본인을 못 찾는다"는 받아들일 수 없다. 회차당 티켓이 수천 장 수준이면
회차로 걸러진 뒤의 순차 스캔으로 충분하다. **실측한 뒤에** 느리면 그때 다시 본다.

### 4-4. 🔴 프로브 임베딩이 로그로 새지 않게

이번 작업에서 가장 눈에 안 띄는 위험이다. 게이트 요청 바디에는 생체 특징값이 실려 있고,
`server/CLAUDE.md` 9장대로 **`ERROR` 로그는 Sentry 로 나간다.** 즉 로그에 남기면 외부 서비스에 남는다.

작업할 때 확인할 것:

- SQL 파라미터 로깅(`show-sql`, `org.hibernate.orm.jdbc.bind` DEBUG, p6spy 류)이 켜져 있으면
  `:probe` 가 그대로 찍힌다. **운영 프로필에서 꺼져 있는지 확인한다.**
- 요청 DTO 에 Lombok `@ToString` / record 기본 `toString` 이 예외 메시지에 실려 나가지 않게 한다.
  (`record` 의 자동 `toString` 은 배열을 주소로 찍지만, `List<Float>` 이면 값이 전부 찍힌다)
- 실패 로그는 **회차 id 와 후보 수까지만** 남긴다. 점수도 임베딩도 남기지 않는다.

### 4-5. 판정 — 통과 / 보류 / 거절 3구간

지금 `Face.SAME_PERSON_THRESHOLD = 0.65` 는 1:1 용이고, SFace 공식 권장 0.363 보다 훨씬 엄격하다.
**1:N 에 같은 값을 그대로 쓰면 안 된다** — 후보가 늘수록 "남인데 우연히 닮은 1등"이 나올 확률이 커진다.

| 판정 | 조건 | 화면 |
|---|---|---|
| `MATCH` | 1등 ≥ `match` **그리고** (1등 − 2등) ≥ `margin` | 초록 · 즉시 입장 기록 |
| `REVIEW` | 1등 ≥ `review` | 노랑 · 좌석/이름 보여주고 **직원이 눌러서 통과** |
| `NO_MATCH` | 그 외 | 빨강 · 다시 찍기 |

**마진 조건이 핵심이다.** 점수만 보면 "0.71 과 0.70 이 나란히 있는" 상황을 통과시켜 버린다.
둘 중 누구인지 모르는 상태인데 1등을 들여보내는 셈이다. 그럴 땐 `REVIEW` 로 내려 사람이 본다.

`REVIEW` 를 둔 이유는 **임계값을 올리면 본인이 거절당하기 때문**이다. `Face` 주석이 적어 둔
그대로 — 같은 사람도 조명·각도에 따라 0.4~0.7 로 흩어진다. 애매한 구간을 거절로 처리하면
입구에서 줄이 선다. 사람에게 넘기는 게 맞다.

임계값은 `GateProperties`(`gate.threshold.*`)로 빼서 **재배포 없이 조정**한다. 8-3 에서 실측한다.

### 4-6. API

**모두 `/admin/**` 아래다.** `SecurityConfig` 의 `.requestMatchers("/admin/**").hasRole(ADMIN)`
이 그대로 적용된다 — 새 규칙을 추가하지 않는다.

#### ① 게이트 진입 — 이 회차를 얼굴로 검표할 수 있나

```
GET /admin/gate/performance-details/{performanceDetailId}
```
```jsonc
{
  "performanceTitle": "…", "startsAt": "…",
  "totalTickets": 1200,
  "faceEnrolledTickets": 0,   // 🔴 대조 가능한 티켓 수
  "admittedCount": 0
}
```

🔴 **이 엔드포인트가 없으면 안 된다.** 지금 상태에서 게이트를 켜면
`faceEnrolledTickets` 가 **0** 이다(2-2). 직원이 카메라를 켜고 한참 찍다가 전부 거절당하는
대신, 화면이 들어가자마자 *"이 회차는 얼굴 검표를 쓸 수 없습니다 — 수동 검표로 진행하세요"*
라고 말해야 한다.

#### ② 대조

```
POST /admin/gate/performance-details/{performanceDetailId}/verify
```
```jsonc
// 요청 — 🔴 이미지가 아니다. 임베딩 배열이다 (client/CLAUDE.md 7장)
{ "embeddings": [[…128개…], […], […]], "modelVersion": "sface-2021dec-v1" }
```

**배열로 받는 이유가 곧 "움직여도 통과시키는" 장치다** (8-1). 클라이언트가 품질 게이트를
통과한 프레임 중 상위 N장을 골라 한 번에 보내고, **서버는 각각 대조해 최댓값**을 쓴다.
평균을 내지 않는 이유는 흔들린 프레임이 섞이면 평균이 같이 나빠지기 때문이다.
`@Size(min = 1, max = 5)` 로 제한한다 (5장 × 1.5KB ≈ 7.5KB).

```jsonc
// 응답
{
  "decision": "MATCH",            // MATCH | REVIEW | NO_MATCH
  "candidateCount": 1200,
  "ticket": {                      // MATCH·REVIEW 일 때만
    "ticketId": 8812, "userName": "김…", "areaName": "A", "seatLabel": "12열 7번"
  },
  "admission": { "admittedAt": "…" },  // MATCH 일 때만
  "similarity": 0.78, "runnerUp": 0.41 // 화면 표시용. 🔴 로그·GA 에 남기지 않는다
}
```

`MATCH` 는 **즉시 입장 기록까지 한다.** 게이트는 회전율이 전부라 "확인하시겠습니까" 를
한 번 더 물으면 줄이 선다. 잘못 찍힌 경우는 ④ 로 되돌린다.

#### ③ 수동 통과 (`REVIEW` 에서 직원이 육안 확인 후)

```
POST /admin/gate/tickets/{ticketId}/admit     → method = MANUAL
```

#### ④ 입장 취소 (오인 입장 되돌리기)

```
DELETE /admin/gate/tickets/{ticketId}/admission
```

되돌릴 수 없는 동작이 아니라 **잘못을 되돌리는** 동작이다. 없으면 오인 입장 한 건에
진짜 관객이 영구히 막힌다.

#### 에러 코드 — `GateErrorCode` (prefix `GATE_`)

`server/CLAUDE.md` 3-2 에 따라 도메인마다 enum 하나. **한 번 나간 코드는 바꾸지 않는다.**

| 코드 | HTTP | 뜻 |
|---|---|---|
| `GATE_001` | 400 | `FACE_MODEL_NOT_ALLOWED` — 기본 얼굴(`bootstrap-default`)의 모델 버전으로 대조를 요청함 |
| `GATE_002` | 409 | `ALREADY_ADMITTED` — 이미 입장한 티켓 |
| `GATE_003` | 409 | `TICKET_NOT_ADMITTABLE` — 취소된 티켓 |
| `GATE_004` | 404 | `ADMISSION_NOT_FOUND` — 되돌릴 입장 기록이 없음 |
| `GATE_005` | 400 | `INVALID_EMBEDDING` — 128차원이 아니거나 NaN/무한대가 섞임 |

🔴 **`GATE_001` 은 설계 때 생각한 것보다 중요한 자리였다.** 원래는 "모델 버전이 안 맞음"
정도로 적어 두었는데, 구현하면서 **이게 막지 않으면 만능 열쇠가 된다**는 걸 알았다.

기본 얼굴은 모든 계정이 **같은 균일 벡터**를 갖는다(`Face.defaultFace()`). 그 값과
`bootstrap-default` 를 함께 보내면 아직 실제 얼굴을 등록하지 않은 티켓 **전부**와
유사도 1.0 으로 붙는다 — 아무나 그 회차의 첫 번째 티켓으로 입장하게 된다. 그래서 대조를
**시도하기 전에** 거절한다. (`GateVerifyIntegrationTests.기본_얼굴의_모델_버전으로는_대조하지_않는다`)

`NO_FACE_ENROLLED_TICKETS` 는 **에러로 만들지 않았다.** 후보가 0장인 건 예외 상황이 아니라
지금의 정상 상태이고(2-2), 그 사실은 진입 API 의 `faceEnrolledTickets` 와 검표 응답의
`candidateCount` 가 이미 말해 준다. 예외로 던지면 화면이 실패 처리로 넘겨 운영자가
수동 검표로 넘어갈 길을 잃는다.

---

## 5. 클라이언트

### 5-1. 붙이는 곳

`AdminSidebar` 주석이 절차를 이미 적어 두었다 — **세 곳만 건드린다.**

1. `shared/constants/routes.ts` → `ADMIN_GATE: '/admin/gate'`
2. `features/admin` 의 `ADMIN_MENU` 에 한 줄 (`visible: can.operateGate`)
3. `app/router/router.tsx` 의 admin 자식에 라우트

`visible` 은 **서버 권한과 같아야 한다** — 판단은 `features/auth` 의 `can` 한 곳에 넣는다.
`FEATURE.gate === false` 면 `can.operateGate` 가 항상 false 라 메뉴도 라우트도 사라진다.
(`can.useTicket` 이 `FEATURE.face` 를 보는 것과 같은 모양)

### 5-2. 얼굴 처리는 새로 만들지 않는다

`features/face/index.ts` 배럴이 필요한 걸 이미 전부 내보내고 있다. 그대로 재사용한다.

```ts
useCamera, useFaceEngine, CameraStage, checkFaceQuality, FACE_GUIDE_IDLE, FACE_GUIDE_READY
```

🔴 **feature 내부를 직접 import 하지 않는다** (`client/CLAUDE.md` 3-1). 배럴만 쓴다.
배럴에 없는 게 필요하면 `features/face/index.ts` 에 export 를 추가하되,
**이미지를 다루는 것은 절대 내보내지 않는다.**

새 코드는 `features/gate/` 에 게이트 고유의 것만 둔다 — 연속 캡처 루프, 판정 표시, 입장 목록.

### 5-3. 등록 화면과 다른 점

| | 등록 (`FaceRegisterPage`) | 게이트 |
|---|---|---|
| 캡처 | 사용자가 버튼을 눌러 1장 | **자동 연속** — 품질 통과 프레임을 계속 모음 |
| 대상 | 자기 자신, 협조적 | 줄 서 있는 관객, 비협조적 |
| 실패 시 | 다시 찍으라고 안내 | **직원이 개입** (수동 통과) |
| 끝난 뒤 | 완료 화면으로 이동 | **바로 다음 사람** — 화면이 초기화돼야 함 |

---

### 5-4. 🔴 뒤에 선 사람 — 게이트를 막던 규칙을 고쳤다

**공연장 입구에는 언제나 뒤에 줄이 서 있다.** 그런데 원래 파이프라인은 얼굴이 둘 이상이면
아무것도 하지 않았다 — 두 곳에서 각각.

| 어디 | 예전 | 지금 |
|---|---|---|
| `faceQuality.checkFaceQuality` | 얼굴 > 1 이면 `MANY_FACES` 로 거절 | **가장 큰 얼굴**을 골라 검사 |
| `face.worker.ts` (`embed`) | `raw.length !== 1` 이면 **임베딩을 아예 건너뜀** | 가장 큰 얼굴을 임베딩 |

"조용한 방에서 혼자 등록" 만 상정한 규칙이라, 그대로 두면 **게이트는 현장에서 한 명도
통과시키지 못한다.** 등록 화면조차 카페나 사무실에서는 안 됐다.

**가장 큰 얼굴 = 카메라에 가장 가까운 사람 = 가이드 원 안에 선 사람.** 뒤에 선 사람은
작게 잡혀 자연히 밀려난다. 화면의 원을 픽셀로 따지지 않는 이유는 미리보기가
`object-cover` 로 잘려 있어 **원과 검출 좌표계가 일치하지 않기** 때문이다 — 크기는 그
어긋남과 무관하다.

🔴 **두 곳이 같은 얼굴을 골라야 한다.** 갈라지면 *화면은 A 를 통과시켰는데 임베딩은 B 에서
뽑히는* 일이 생긴다 — 남의 얼굴로 등록되고 아무도 눈치채지 못한다. 양쪽 주석에 서로를
가리켜 뒀다.

**안전장치는 남겼다.** 비슷한 크기(80% 이상)의 얼굴이 **함께 가운데** 있으면 여전히
`MANY_FACES` 다. 두 사람이 나란히 선 경우라 누구를 찍는지 정할 수 없다.

실제 모듈로 확인한 동작:

| 상황 | 결과 |
|---|---|
| 혼자 | 통과 |
| 뒤에 한 명 · 두 명 | **통과** |
| 검출 순서가 뒤바뀜(뒤사람이 배열 앞) | **통과** — 순서가 아니라 크기로 고른다 |
| 나란히 두 명 | `MANY_FACES` |
| 뒤에만 있음 | `TOO_SMALL` — "가까이 와주세요" |

### 5-5. 자동 셔터 — 버튼을 없앴다

`useAutoShutter` 가 품질이 **0.9초 유지되면** 스스로 찍는다. 등록 화면의 촬영 버튼을 뺐다.

- 버튼을 누르는 순간 손가락이 움직여 **그 흔들림이 프레임에 남는다.** 버튼을 찾느라 시선도
  정면에서 벗어난다. 가만히 있으면 찍히는 편이 더 좋은 사진을 만든다.
- 스치듯 만족한 한 프레임에 찍지 않는다. 계속 통과해야 눌리므로 자세가 자리를 잡은 뒤에 찍힌다.
  중간에 깨지면 처음부터 다시 센다.
- 🔴 **진행을 반드시 보여줘야 한다.** 안 보이면 사람은 언제 찍히는지 몰라 계속 움직이고,
  그러면 카운트가 영원히 처음으로 돌아간다. `CameraStage` 아래 선이 차오른다.

게이트 화면(Phase 2)도 같은 훅을 쓴다 — 입구에서 직원이 셔터를 누르고 있을 수는 없다.

---

## 6. 단계

각 단계는 그 자체로 머지 가능하고, **스위치가 꺼져 있어 운영에 영향이 없다.**

| Phase | 내용 | 스위치 | 상태 |
|---|---|---|---|
| **1** | `admissions` 마이그레이션 + `gate` 도메인 + API ①②③④ + `GateProperties` | `gate.enabled=false` | **완료** (2026-09-16) |
| **2** | 어드민 게이트 화면 (연속 캡처, 3구간 표시, 수동 통과) | `FEATURE.gate=false` | 다음 |
| **3** | 정확도 — 등록 다중 샷(centroid), 임계값 실측 | 〃 | |
| **4** | 라이브니스 | 〃 | |
| **5** | **켜기** — 기본 얼굴 해소 + 재등록 안내 + 개인정보처리방침 문구 | `true` | |

> best-of-N 은 Phase 1 에 들어갔다 — 서버가 임베딩 배열을 받아 최댓값을 쓰는 형태라
> API 규격의 일부였고, 나중에 붙이려면 요청 규격을 다시 바꿔야 했다. Phase 3 에 남은 것은
> **등록 다중 샷(centroid)** 과 **임계값 실측** 이다.

### Phase 1 에서 실제로 만든 것

| 파일 | |
|---|---|
| `V20260916_1000__add_admissions.sql` | `admission_method` ENUM · `admissions` 테이블 · `UNIQUE (ticket_id)` |
| `gate/entity/` | `Admission` · `AdmissionMethod` |
| `gate/repository/` | `AdmissionRepository` · `GateTicketRepository` (pgvector 네이티브 쿼리) |
| `gate/service/` | `GateVerifyService` (1:N 대조 · 3구간 판정) · `GateAdmissionService` (입장·취소) |
| `gate/controller/` | `AdminGateController` — `@ConditionalOnProperty("gate.enabled")` |
| `gate/dto/` | `GateVerifyRequest` · `GateVerifyResponse` · `GateSessionResponse` · `GateAdmissionResponse` · `GateDecision` |
| `common/config/GateProperties.java` | `gate.enabled` · `gate.threshold.{match,review,margin}` |
| `SwaggerConfig` | `11-gate` 그룹 |
| 테스트 | `GateVerifyIntegrationTests` (16) · `AdminGateControllerSwitchTests` (2) |

전체 스위트 **382개 통과**. `AdminGateControllerSwitchTests` 가 **기본값에서 컨트롤러 빈이
뜨지 않는 것**을 못 박는다 — 누가 기본값을 true 로 바꾸면 거기서 걸린다.

---

## 7. Phase 5 에서 답해야 할 것 (지금 아님)

미리 적어 둔다. 게이트를 실제로 켤 때 이게 안 풀려 있으면 못 켠다.

- **기존 티켓의 `bootstrap-default` 를 어떻게 하나.** 이미 발권된 티켓의 얼굴은 사람과 무관한
  값이다. 재등록해도 **티켓에 베껴 둔 값은 안 바뀐다** (`Ticket` 이 참조가 아니라 복사라서).
  → 재등록 시 해당 회원의 **미래 티켓만** 유효한가, 아니면 기존 티켓의 복사본도 갱신하나?
  후자면 "예매 당시 얼굴을 남긴다"는 원래 의도와 충돌한다.
- 얼굴 검표를 쓰는 공연은 **예매 전에 실제 등록을 강제**하나 (`Face.isDefault()` 면 예매 차단),
  아니면 입장 전 안내만 보내나.
- 개인정보처리방침의 얼굴 문단 — 지금은 `FEATURE.face` 를 따라 붙었다 빠진다.
  **입장 기록(`admissions`)도 고지 대상**이다. 보관 기간도 정해야 한다.
- `admissions` 파기 정책. 탈퇴 시 `faces` 와 `tickets.face_embedding` 을 지우는데
  (`server/CLAUDE.md` 6장 표), 입장 기록은 생체정보가 아니지만 **누가 언제 어디 있었는지**의 기록이다.
  → 6장 표에 **세 번째 열이 생긴다.** `FaceDeletionIntegrationTests` 가 지키는 범위도 함께 본다.

---

## 8. 얼굴이 움직여서 벡터가 달라지는 문제

**모델 문제가 아니다.** 허깅페이스에서 새 인식 모델을 가져와도 안 풀린다 — 같은 사람이
조명·각도에 따라 흩어지는 건 SFace 든 ArcFace 든 똑같다. **캡처 전략과 임계값의 문제**다.

### 8-1. best-of-N (Phase 2 에 포함)

2초 동안 프레임을 모아 품질 게이트(`checkFaceQuality`)를 통과한 것 중 **상위 N장**을 한 번에
보내고 서버가 **최댓값**을 쓴다 (4-6 ②). 한 프레임이 흔들려도 다른 프레임이 통과시킨다.

**평균을 내지 않는다.** 흔들린 프레임이 섞이면 평균이 같이 나빠진다.

### 8-2. 등록을 다중 샷으로 (Phase 3)

지금 등록은 **1장**이다 (`useFaceRegistration` — `Float32Array` 하나). 그 1장이 어쩌다 잘
안 나오면 그 사람은 게이트에서 계속 떨어진다.

3~5장 찍어 품질 통과분만 **L2 정규화 → 평균 → 다시 정규화**(centroid)한다.
**DB 스키마는 그대로다** — 여전히 `vector(128)` 한 개다. 분산만 줄어든다.

### 8-3. 임계값은 실측으로 정한다

🔴 **지금 숫자를 정하지 마세요.** 4-5 의 `match` · `review` · `margin` 은 전부 실측 대상이다.

**실측 화면을 만들어 뒀다 — `/dev/face-bench`** (운영 번들에는 없음).
기존 `/dev/face` 는 사진 3장으로 "파이프라인이 도는가" 를 보는 화면이라 이 일에는 못 쓴다.

| 이 화면이 하는 것 | |
|---|---|
| **카메라로 바로 찍기** | 이름을 넣고 연속 촬영. **현장과 같은 조건**이다 — 웹캠 · 같은 품질 게이트 · 같은 파이프라인 |
| 파일명으로 사람 묶기 | `kim_01.jpg` · `kim-정면.jpg` · `kim01.jpg` → 모두 `kim`. 폰 사진을 쓸 때 |
| 1:1 분포 | 모든 쌍을 같은 사람 / 다른 사람으로 갈라 min·중앙·상위5%·max |
| FRR / FAR 스윕 | EER, 그리고 **오인 통과가 0 이 되는 최저 임계값** |
| **1:N 게이트 시뮬레이션** | 서버의 `GateVerifyService.findBest` 와 **같은 규칙**을 돌린다 |
| 슬라이더 | `match` · `review` · `margin` 을 끌면 통과/오통과/보류/거절 건수가 즉시 바뀐다 |
| 등록 장수 | 1 → 3 으로 올리면 **centroid 등록이 값어치 있는지** 가 바로 보인다 (8-2 의 판단 근거) |
| best-of-N | 한 번에 보낼 장수를 올려 **여러 장 보내는 효과**를 숫자로 본다 |
| 출력 | 정한 값을 `application.yaml` 스니펫으로 그대로 뽑아 준다 |

🔴 **시뮬레이션 규칙이 서버와 갈라지면 이 화면의 숫자는 거짓말이 된다.** 프레임마다
1등·2등을 구하고 **1등이 가장 높은 프레임**을 골라 그 프레임의 2등으로 마진을 잰다 —
`simulateGate` 와 `GateVerifyService.findBest` 양쪽 주석에 서로를 가리켜 뒀다.

**재는 방법**

1. 팀원 **최소 8~10명**, 한 사람당 **8장 이상** (등록 1~3장 + 검표 시도).
   - 사람이 2~3명이면 잰 숫자가 현장에서 안 맞는다. 1:N 은 후보가 늘수록 어려워진다.
2. `/dev/face-bench` 에서 **카메라로 바로 찍는다.** 이름을 넣고 촬영 시작 → 화면 지시대로
   조금씩 움직이면 품질 게이트를 통과한 프레임만 모인다. 폰 사진은 조건이 달라 차선이다.
   - **한 세션에 8장 고정**이다(지시문 한 바퀴). 장수를 고르게 하면 3장만 찍고 끝내는데,
     그러면 표본에 **정면 비슷한 것만** 남아 실제보다 좋은 숫자가 나온다.
   - 장 사이에 **2초**를 쉰다. 그동안 다음 지시가 떠 있으니 읽고 자세를 바꾸면 된다.
     0.7초로 해봤더니 읽기도 전에 다음 장이 찍혀 결국 같은 자세가 여러 장 모였다.
   - 🔴 **가만히 있는 채로 연사하지 말 것.** 거의 같은 프레임이 모이면 같은 사람 유사도가
     0.99 로 떠서, 실제로는 통과 못 할 임계값도 통과해 보인다. 그 숫자로 켜면 현장에서
     본인이 줄줄이 거절당한다. 화면이 지시문을 돌려 가며 띄우는 이유다.
   - 🔴 지시는 전부 **품질 게이트가 허용하는 범위 안**이다("살짝"). 운영에서는
     `checkFaceQuality` 가 정면이 아닌 프레임을 아예 임베딩하지 않으므로, 고개를 크게
     돌려 찍은 표본으로 잰 숫자는 현장과 무관하다.
   - **같은 사람을 조명을 바꿔 여러 번** 찍으면 더 좋다. 같은 이름을 넣으면 합쳐진다.
   - 검출 실패한 사진은 **현장에서도 실패한다** — 왜 실패했는지 보고 촬영 조건을 잡는다.
3. **다른 사람의 최댓값**을 먼저 본다. 통과선이 이 값보다 낮으면 남이 들어온다.
4. 슬라이더로 **남을 통과 = 0** 이 되는 가장 낮은 `match` 를 찾는다.
5. 거기서 본인 거절과 보류 건수가 운영할 만한지 본다. 보류는 실패가 아니다 — 운영자가 눈으로 보는 건수다.
6. 등록 장수를 1 → 3 으로 바꿔 본다. 차이가 크면 8-2(등록 다중 샷)를 Phase 3 에 넣는다.

🔴 사진은 브라우저 밖으로 나가지 않는다. 미리보기조차 만들지 않는다(수십 장이면 메모리에
계속 남는다). **이 저장소에 얼굴 사진을 커밋하지 마세요.**

| | 값 | 근거 |
|---|---|---|
| `gate.threshold.match` | _(미정)_ | |
| `gate.threshold.review` | _(미정)_ | |
| `gate.threshold.margin` | _(미정)_ | |

참고로 SFace 공식 권장은 **0.363**(OpenCV Zoo `demo.py`)이고, 현재 1:1 본인확인은 0.65 다.
ArcFace 감각으로 0.6~0.7 을 기대하면 같은 사람을 자꾸 거절한다.

### 8-4. 라이브니스 (Phase 4) — 허깅페이스가 필요한 유일한 자리

현장의 진짜 위협은 "닮은 사람"이 아니라 **남의 사진을 폰으로 들이대는 것**이다.
지금 파이프라인은 이걸 전혀 막지 못한다. (`public/models/README.md` 가 "안티스푸핑은 다음 단계"로 적어 둔 그것)

**추천: 모델 없이 액티브 챌린지.** 화면이 무작위로 "왼쪽을 보세요 / 눈을 감았다 뜨세요" 를
띄우고, **이미 있는 YuNet 랜드마크**의 yaw 변화로 검증한다.

- 런타임·용량 추가가 **0** 이다. *"WASM 런타임은 하나만"* 규칙(`client/CLAUDE.md` 7장)과 충돌하지 않는다.
- `faceQuality.ts` 가 이미 코와 두 눈으로 yaw 를 계산하고 있어 재사용된다.

**모델을 넣는다면** MiniFASNet 계열(Silent-Face-Anti-Spoofing) ONNX 가 2MB 미만으로 후보다.
다만 (1) 허깅페이스 재업로드본은 라이선스·출처가 불분명한 경우가 많고, (2) 이미 9.9MB 를
쓰고 있어 용량 예산을 다시 재야 한다 (*"라이브러리나 모델을 늘리기 전에 전송량을 다시 재세요"*).

### 8-5. 🔴 인식 모델은 바꾸지 않는다

`public/models/README.md` 가 경고하는 그대로다.

> 모델을 바꾸면 해시와 `VITE_FACE_MODEL_VERSION` 을 함께 올리세요 — 임베딩은 같은 모델끼리만
> 대조됩니다. 조용히 바뀌면 등록해 둔 얼굴로 입장이 안 됩니다.

ArcFace 512차원으로 가면 `faces.embedding` · `tickets.face_embedding` 의 `vector(128)`,
`Face.EMBEDDING_DIMENSION`, 전처리 정규화 방식, 임계값이 **전부** 바뀐다. 이번 작업이 아니다.

---

## 9. 작업 전 확인할 것

- [ ] pgvector `<=>` 가 Hibernate 네이티브 쿼리에서 파라미터 바인딩으로 동작하는지 (`CAST(:probe AS vector)`)
- [ ] SQL 파라미터 로깅 — `application.yaml` 에 `logging.level` · `show-sql` 설정이 **없어서
      지금은 꺼져 있다.** 디버깅한다고 켜면 임베딩이 로그로, 이어서 Sentry 로 나간다 (4-4)
- [ ] Flyway 버전이 `V20260915_1010` 뒤에 오는지, 머지 직전에 다시 맞출 것 (`server/CLAUDE.md` 5장)
- [ ] `SwaggerConfig` 에 `gate` 그룹 `GroupedOpenApi` 빈 추가 (`server/CLAUDE.md` 4장)
- [ ] `server/CLAUDE.md` 6장이 **"512차원"** 이라고 적고 있다 — 실제는 128 이다. 문서 드리프트, 같이 고칠 것

---

## [결정 이력]

| 날짜 | 결정 | 이유 |
|---|---|---|
| 2026-09-16 | 얼굴 벡터를 온체인에 올리지 않는다 | 지울 수 없다 — 탈퇴 시 즉시 파기 고지와 충돌 (2-1) |
| 2026-09-16 | `TicketStatus.ENTERED` 대신 `admissions` 테이블 | 입장은 예매 상태가 아니고, 기존 status 쿼리 전부에 영향 (4-2) |
| 2026-09-16 | 중복 입장 차단은 DB UNIQUE 제약으로 | 애플리케이션 검사는 게이트 2대 동시 요청에서 뚫림 (4-2) |
| 2026-09-16 | 1:N 대조는 pgvector 가, Java 가 아니라 | 임베딩을 JVM 으로 꺼내지 않는다 (4-3) |
| 2026-09-16 | 판정을 통과/보류/거절 3구간 + 마진 조건 | 점수만 보면 "0.71 대 0.70" 을 통과시킴 (4-5) |
| 2026-09-16 | 벡터 인덱스(HNSW)를 처음엔 만들지 않는다 | 근사 검색이라 1등을 놓칠 수 있음 (4-3) |
| 2026-09-16 | 기본 얼굴(`bootstrap-default`) 은 이번에 건드리지 않는다 | 모델 버전 필터가 자동으로 걸러 게이트가 무해함 (2-2) |
| 2026-09-16 | 주석 처리 대신 스위치 2개 (`gate.enabled` · `FEATURE.gate`) | `features.ts` 가 명시적으로 금지 (2-3) |
| 2026-09-16 | **구현** `GATE_001` 을 "모델 불일치" 가 아니라 "기본 얼굴 거절" 로 | 그 벡터는 전 계정 공통이라 보내면 만능 열쇠가 된다 (4-6) |
| 2026-09-16 | **구현** `NO_FACE_ENROLLED_TICKETS` 를 에러로 만들지 않음 | 후보 0장은 예외가 아니라 지금의 정상 상태. 예외면 수동 검표로 넘어갈 길이 막힌다 |
| 2026-09-16 | **구현** `Admission` 이 티켓·운영자를 `@ManyToOne` 이 아니라 id 로 보유 | 입장 생성에 Ticket 엔티티가 필요 없다. 지연 로딩 경계만 늘어난다. 무결성은 FK 가 지킨다 |
| 2026-09-16 | **구현** `candidateCount` 를 `COUNT(*) OVER ()` 로 같은 쿼리에서 | 세는 쿼리를 한 번 더 날리지 않는다 — 사람이 줄 서서 기다리는 경로다 |
| 2026-09-16 | **구현** 게이트 서비스에 클래스 `@Transactional` 을 걸지 않음 | UNIQUE 위반을 트랜잭션 안에서 잡으면 rollback-only 가 남아 커밋에서 터진다 |
| 2026-09-16 | **구현** 유사도가 유한수가 아니면 후보에서 제외 | 저장된 0 벡터는 거리가 NaN 이 되고, NaN 은 모든 비교에 false 라 임계값 검사를 그냥 통과한다 |
| 2026-09-16 | 얼굴이 여럿이면 거절하지 않고 **가장 큰 얼굴**을 고른다 (검사·워커 양쪽) | 입구에는 늘 뒤에 줄이 있다. 예전 규칙이면 게이트가 한 명도 통과시키지 못한다 (5-4) |
| 2026-09-16 | 비슷한 크기 얼굴이 함께 가운데면 여전히 `MANY_FACES` | 두 사람이 나란히 선 경우는 누구를 찍는지 정할 수 없다 (5-4) |
| 2026-09-16 | 촬영 버튼을 없애고 자동 셔터(0.9초 유지) | 버튼을 누르는 손가락이 흔들림을 만들고 시선이 정면에서 벗어난다 (5-5) |
| 2026-09-17 | **QR 로 티켓을 특정한 뒤 1:1 대조** (확정) | 후보가 하나면 마진 조건이 필요 없고, 오인 통과가 후보 수에 비례하지 않는다. 1:N 은 QR 을 못 읽을 때의 폴백으로 남긴다 |
| 2026-09-17 | 얼굴 커밋먼트 온체인 **보류** | 검표는 어차피 오프체인 유사도라 체인이 하는 일이 없다. 필요해지면 해시로 다시 검토 (2-1) |
| 2026-09-17 | 티켓에 벡터를 **몇 개** 저장할지는 실측 후 결정 | 1개 / 평균 1개 / N개는 <b>스키마가 다르다</b>. N개는 본인에게도 남에게도 N 번의 기회를 주므로 재보지 않고 정할 수 없다 (8-2) |
