# CLAUDE.md — 티캣 백엔드 공통 규칙

> 이 파일은 **Claude Code가 `server/` 에서 작업할 때 따라야 하는 규칙**입니다.
> 팀원 여러 명이 각자 Claude로 작업하기 때문에, 이 문서가 유일한 기준입니다.
> (프론트엔드 규칙은 [`../client/CLAUDE.md`](../client/CLAUDE.md) 에 따로 있습니다)

---

## 0. 규칙 변경 절차

아래를 바꿔야 하는 작업은 **먼저 사용자에게 물어보세요.**

| 변경 대상 | 예시 |
|---|---|
| 이 `CLAUDE.md` 자체 | 규칙 추가/수정/삭제 |
| 패키지 구조 | 새 최상위 패키지, 도메인 내부 구성 변경 |
| 공통 응답·예외 구조 | `BaseResponse`, `ErrorCode`, `GlobalExceptionHandler` |
| 인증 방식 | JWT 정책, `SecurityConfig` 의 공개 경로 |
| 라이브러리 추가/교체 | `build.gradle` 의존성 |
| 이미 머지된 마이그레이션 | `db/migration/**` 수정 |
| 설정 체계 | `application.yaml` 구조, 환경변수 |

규칙 **안에서** 하는 일반 작업(도메인 추가, API 구현, 버그 수정)은 물어볼 필요 없습니다.

---

## 1. 기술 스택

| 영역 | 선택 |
|---|---|
| 언어/런타임 | Java 21 (Gradle toolchain), Spring Boot 4.1.x |
| 웹 | `spring-boot-starter-webmvc` |
| 영속성 | Spring Data JPA + Hibernate, PostgreSQL 18 (pgvector) |
| 마이그레이션 | Flyway (`ddl-auto: validate` — 스키마의 원본은 SQL) |
| 캐시/세션 | Redis |
| 인증 | Spring Security + JWT (jjwt) |
| 문서 | springdoc-openapi (Swagger UI) |
| 벡터 | hibernate-vector + pgvector (얼굴 임베딩 512차원) |
| 보일러플레이트 | Lombok |
| 지표 | Micrometer → Prometheus (`/actuator/prometheus`) |
| 에러 리포팅 | **sentry-logback** (자동설정 스타터 아님 — 아래 9장) |

---

## 2. 패키지 구조

```
com.teacat.server
├── common/              도메인을 모르는 공용 코드
│   ├── config/          SwaggerConfig, SecurityConfig …
│   ├── exception/       BaseResponse 규격의 예외 뼈대
│   └── response/        BaseResponse
├── auth/                인증 도메인
└── <도메인>/             user, performance, booking, ticket …
```

### 도메인 내부 구성 (예: `performance`)

```
<도메인>/
├── controller/
├── dto/
│   ├── request/
│   └── response/
├── entity/
├── exception/           <도메인>ErrorCode
├── repository/
└── service/
```

**모든 도메인이 이 구조를 그대로 따릅니다.** 폴더를 늘리거나 이름을 바꾸려면 0번 절차입니다.
(예외: `auth/security/` — 필터·토큰 프로바이더처럼 인증 도메인 고유의 인프라 코드)

### 의존 방향

```
controller → service → repository → entity
                  ↘ 다른 도메인의 service / repository
```

- `common` 은 도메인을 **모릅니다.** `common` 안에서 도메인 패키지를 import 하지 마세요.
  (`SecurityConfig` 가 `auth.security` 를 조립하는 것처럼, 스프링 설정이 빈을 엮는 경우만 예외)
- 컨트롤러는 **엔티티를 노출하지 않습니다.** 응답은 항상 `dto/response` 의 record 로 변환합니다.

---

## 3. 공통 응답과 예외

### 3-1. 모든 응답은 `BaseResponse` 로 감쌉니다

```java
return ResponseEntity.ok(BaseResponse.success(data));                    // 데이터만
return ResponseEntity.ok(BaseResponse.success("변경되었습니다."));         // 메시지만
return ResponseEntity.status(HttpStatus.CREATED)
        .body(BaseResponse.success("가입이 완료되었습니다.", data));        // 메시지 + 데이터
```

`null` 필드는 응답 JSON에서 빠집니다(`@JsonInclude(NON_NULL)`).
프론트는 `{ success, data }` 봉투를 벗겨 쓰므로 **봉투를 건너뛰지 마세요.**

### 3-2. 예외는 `BusinessException` + 도메인별 `ErrorCode`

```java
throw new BusinessException(UserErrorCode.USER_NOT_FOUND);
```

- 에러 코드는 **도메인마다 하나의 enum** 으로 관리합니다: `<도메인>/exception/<도메인>ErrorCode.java`
- `ErrorCode` 인터페이스(`httpStatus`, `code`, `message`)를 구현합니다.
- 코드 문자열은 `도메인_일련번호` 형식이고 **한 번 나간 코드는 바꾸지 않습니다.**
  (프론트가 코드로 분기합니다)

| 도메인 | prefix | 예 |
|---|---|---|
| 인증 | `AUTH_` | `AUTH_001` 로그인 실패 |
| 회원 | `USER_` | `USER_001` 존재하지 않는 회원 |

- `GlobalExceptionHandler` 가 `BusinessException`, `@Valid` 실패, 그 외 예외를 처리합니다.
  **컨트롤러/서비스에서 try-catch 로 응답을 만들지 마세요.**
- Security 필터에서 나는 401/403 은 핸들러까지 오지 않으므로
  `JwtAuthenticationEntryPoint` / `JwtAccessDeniedHandler` 가 같은 형식으로 내려줍니다.

### 3-3. 검증은 DTO에서

요청 DTO는 record + Bean Validation(`@NotBlank`, `@Pattern` …)이고, 컨트롤러에서 `@Valid` 를 붙입니다.
서비스는 **비즈니스 규칙**(중복, 상태 전이)만 검사합니다.

---

## 4. API 규칙

- 문서화: 컨트롤러에 `@Tag`, 메서드에 `@Operation`, DTO 필드에 `@Schema` 를 답니다.
- Swagger 그룹은 **경로가 아니라 도메인 패키지**로 나눕니다 (`SwaggerConfig`).
  URL 이 바뀌어도 그룹이 안 깨집니다. 도메인을 추가하면 `GroupedOpenApi` 빈을 하나 추가하세요.
  (드롭다운 정렬은 `displayName` 기준입니다 — 그룹 이름의 숫자 접두어는 문서 주소에만 씁니다)
- 인증이 필요한 컨트롤러에는 `@SecurityRequirement(name = "bearerAuth")` 를 붙입니다.
- 인증 주체는 `@AuthenticationPrincipal AuthUser authUser` 로 받습니다.
  (`@Parameter(hidden = true)` 를 함께 붙여 Swagger 파라미터에서 숨깁니다)
  **경로/바디로 받은 userId 를 믿지 마세요.**
- 공개 경로는 `SecurityConfig.PUBLIC_ENDPOINTS` 한 곳에서만 관리합니다.
- 비밀번호는 `PasswordEncoder`(BCrypt)로만 저장·검증합니다.

### 인증 흐름 (자동 로그인)

| 토큰 | 어디에 | 수명 | 저장소 |
|---|---|---|---|
| 액세스 토큰 (JWT) | 응답 바디 → 프론트 메모리/스토어 → `Authorization: Bearer` | 1시간 | 없음(무상태 검증) |
| 리프레시 토큰 (난수) | **httpOnly 쿠키** (`jwt.refresh-cookie.path`, 기본 `/`) | 14일 | Redis `refresh:{token}` → userId |

- 리프레시 토큰은 JWT 가 아니라 **의미 없는 난수**입니다. Redis 에서 지우면 즉시 무효화됩니다.
- `POST /auth/refresh` 는 **회전**합니다 — 쓴 토큰은 폐기하고 새 토큰을 쿠키로 다시 내려줍니다.
- 리프레시 토큰을 응답 바디에 담거나 JS 가 읽을 수 있는 곳에 두지 마세요.
- 쿠키를 주고받으려면 CORS `allowCredentials` 가 필요하고, 그래서 origin 에 `*` 를 못 씁니다.
  허용 주소는 `cors.allowed-origins` 에만 적습니다.
- 쿠키 `path` 는 **브라우저가 보는 경로** 기준입니다. 프론트가 `/api` 프리픽스로 호출하면
  `REFRESH_COOKIE_PATH=/api/auth` 처럼 맞춰야 재발급 요청에 쿠키가 실려 옵니다.

### SSAFY 계정 로그인 (OAuth 2.0 Authorization Code)

```
버튼 → GET /auth/oauth/ssafy/authorize → (SSAFY 로그인)
     → GET /auth/oauth/ssafy/callback  → 기존 회원: 리프레시 쿠키 + status=success
                                       → 신규:     가입 티켓 쿠키 + status=signup
     → 프론트 /oauth/callback 이 처리 (success 면 POST /auth/refresh 로 토큰 획득)
```

- **제공자 스펙에 의존하는 곳은 `auth/client/SsafyOauthClient` 하나입니다.** 주소·키는 `oauth.ssafy.*` 설정에 있고,
  `client-secret` 은 설정 파일에 적지 않고 환경변수(`SSAFY_CLIENT_SECRET`)로만 넣습니다.
- 설정이 비어 있으면 `AUTH_008` 로 거절합니다. 나머지 기능은 그대로 동작합니다.
- **콜백에서 회원을 미리 만들지 않습니다.** 닉네임·전화번호가 빈 "유령 회원" 이 남기 때문입니다.
  인증만 끝난 상태는 Redis 의 가입 티켓(10분)으로 들고 있다가 추가정보를 받을 때 회원을 만듭니다.
- 연결의 기준은 제공자 식별자(`provider_user_id`)입니다. 이메일은 바뀔 수 있어 기준이 될 수 없습니다.
  단, 이메일이 같은 기존 회원이 있으면 같은 사람으로 보고 자동으로 연결합니다.
- 소셜 전용 계정은 `users.password` 가 null 입니다. 비밀번호를 쓰는 기능은 `User.hasPassword()` 로 먼저 막습니다.
- authorize/callback 은 **브라우저가 직접 오가는 페이지 이동**이라 실패해도 JSON 을 보여줄 수 없습니다.
  결과를 쿼리 파라미터에 담아 프론트로 되돌려 보냅니다.

---

## 5. Flyway 규칙

- **버전 번호**: 날짜 + 시간 + 수정사항 조합 (예: `V20260722_0837__add_user.sql`)
  - 언더스코어 개수 정확히 — 날짜 뒤 1개, 시간 뒤 2개
- **한번 머지된 SQL은 수정 금지** (수정이 필요하면 새 버전을 추가)
- **머지 전에 최신화 및 순서 정렬 필수**
  - 작업 브랜치에 `dev` 를 PULL 하여 최신화
  - 추가한 SQL 버전이 **제일 마지막에 실행되도록** 날짜+시간 수정
  - 로컬 DB에서 문제없이 실행되는지 확인
- 엔티티는 SQL을 따라갑니다. `ddl-auto` 는 `validate` 이며 **바꾸지 마세요.**

---

## 6. 개인정보 · 생체정보

- **얼굴 원본 이미지는 서버로 오지 않습니다.** 클라이언트(브라우저)에서 추출한
  512차원 임베딩만 받아 `faces.embedding` 에 저장합니다.
  (프론트 규칙 `client/CLAUDE.md` 7장과 한 쌍입니다 — 서버가 이미지를 받고 싶어지면 먼저 상의)
- 회원 탈퇴는 소프트 삭제(`users.deleted_at`)이고, 탈퇴·얼굴 삭제 시 `faces` 행은 **즉시 파기**합니다.
- 🔴 **단, `tickets.face_embedding` 의 복사본은 남습니다** (2026-09-15 결정, 아래 이력).
  예매 당시의 얼굴을 티켓에 남기기로 해서 **가리키지 않고 베껴 두기** 때문입니다.
  그래서 생체정보의 파기 범위를 따질 때 `faces` 만 보면 안 됩니다 — **두 곳**입니다.
  ⚠️ 프론트의 개인정보처리방침(`client/src/pages/PrivacyPolicyPage.tsx`)에는 아직
  "회원 탈퇴 또는 얼굴 삭제 요청 시 즉시 파기합니다" 로 적혀 있습니다. **지금 동작과
  다릅니다** — 고지를 고치든 동작을 되돌리든 둘 중 하나를 해야 합니다(사람이 판단할 일).
- 로그에 이메일·전화번호·토큰·임베딩을 남기지 마세요.
  🔴 이 규칙이 더 중요해졌습니다 — `ERROR` 로그는 이제 **Sentry 로도 나갑니다**(9장).
  로그에 남기면 외부 서비스에 남는 것입니다.
- 시크릿은 코드에 박지 않습니다. `application.yaml` 은 로컬 기본값 + 환경변수 오버라이드
  (`${JWT_SECRET:...}`) 형태로만 둡니다.

---

## 7. 로컬 실행

```bash
# 1) 인프라 (프로젝트 루트에서)
docker compose -f docker/docker-compose.yml up -d

# 2) 서버
cd server
./gradlew bootRun
```

- JDK 21 이 필요합니다 (`JAVA_HOME` 설정 필요).
- 시크릿은 `server/.env` 에 둡니다. `.env.example` 을 복사해서 값을 채우세요 (`.env` 는 커밋되지 않습니다).
  `application.yaml` 의 `spring.config.import` 가 읽어들이므로 `${...}` 자리에 그대로 들어갑니다.
- Swagger UI: http://localhost:8080/swagger-ui.html
- 애플리케이션 기동 시 Flyway가 마이그레이션을 적용하고 Hibernate가 스키마를 검증합니다.

---

## 9. 에러 리포팅 (Sentry)

Prometheus/Grafana 는 **"몇 건 터졌나"**를 보여줍니다. Sentry 는 **"무엇이 왜 터졌나"** —
스택트레이스와 직전 로그를 보여줍니다. 둘은 대체재가 아니라 짝입니다.

### 🔴 자동설정 스타터를 쓰지 마세요

`io.sentry:sentry-spring-boot-starter-jakarta:8.16.0` 은 **스프링 부트 4 에서 뜨지 않습니다.**
내부의 `SentrySpanRestClientConfiguration` 이
`org.springframework.boot.web.client.RestClientCustomizer` 를 참조하는데, 부트 4 에서
`org.springframework.boot.restclient` 로 옮겨간 클래스입니다. 자동설정 조건을 읽는 단계에서
`NoClassDefFoundError` 가 나고 **애플리케이션 컨텍스트가 통째로 뜨지 않습니다.**
`@ConditionalOn*` 으로 우회되지 않습니다 (조건을 평가하기 전에 터집니다).

그래서 자동설정 없이 **로그백 어펜더 하나만** 붙였습니다 — `common/config/SentryConfig`.
Sentry 가 부트 4 를 지원하면 그 클래스를 지우고 스타터로 갈아타면 됩니다.

### 무엇이 올라가나

| 로그 레벨 | Sentry |
|---|---|
| `ERROR` | **이슈로 올라감** (스택트레이스 + 직전 로그) |
| `WARN` / `INFO` | 이슈 아님. 이벤트에 붙는 빵부스러기(breadcrumb) |

`GlobalExceptionHandler` 의 `log.error("Unexpected error: ", e)` 가 그대로 잡힙니다.
컨트롤러 밖(필터 체인·스케줄러·비동기)의 에러도 `ERROR` 로 찍히기만 하면 함께 올라갑니다.

`BusinessException` 은 올라가지 않습니다 — 좌석 선점 실패처럼 **정상 동작**이라
카운터로만 세고 있습니다. 그건 Grafana 가 볼 몫입니다.

### 설정

- `sentry.dsn` 이 비어 있으면 **아예 켜지지 않습니다.** 로컬·CI 는 그대로 두면 됩니다.
- 값은 저장소에 두지 않고 `docker/.env.dev` · `.env.prod` 의 `SENTRY_DSN` 으로 주입합니다.
  🔴 **프론트 DSN 과 다른 값입니다** — Sentry 프로젝트가 따로입니다(플랫폼: Spring Boot).
- dev/prod 구분은 compose 가 `SENTRY_ENVIRONMENT` 로 고정해 넘깁니다.

### 🔴 생체정보

자동설정을 쓰지 않으므로 **HTTP 요청 본문이 이벤트에 실리지 않습니다.**
얼굴 임베딩(`POST /users/me/face`)·비밀번호·결제 정보가 새어 나갈 경로가 없습니다.
나중에 스타터나 서블릿 연동을 붙이게 되면 **반드시** 요청 본문 수집을 끄고 시작하세요(0번 절차).

---

## 8. 커밋

```
<type>: <요약> (S15P21A402-<이슈번호>)
```

`feat`, `fix`, `chore`, `refactor`, `test`, `docs` 를 씁니다. 본문·요약은 한국어입니다.

---

## [규칙 변경 이력]

- 2026-09-02 최초 작성 (회원 도메인 작업 중 정리)
- 2026-09-02 인증 흐름(자동 로그인 · 리프레시 토큰 회전) 항목 추가
- 2026-09-03 SSAFY 계정 로그인 항목 추가
- 2026-09-03 Swagger 그룹(도메인 패키지 기준) · 로컬 시크릿(.env) 항목 추가
- 2026-09-10 **sentry-logback 추가** (1장 기술 스택, 9장 신설, 6장에 한 줄).
  배포본에서 터진 예외를 스택트레이스로 보기 위해서입니다.
  🔴 자동설정 스타터(`sentry-spring-boot-starter-jakarta`)는 **스프링 부트 4 에서
  컨텍스트가 뜨지 않아** 쓰지 않았습니다 (9장에 원인과 복귀 조건). 로그백 어펜더만 붙였습니다.
  `sentry.dsn` / `sentry.environment` / `sentry.release` 를 `application.yaml` 에 추가하고
  compose 의 server 서비스에서 넘깁니다. DSN 이 비면 켜지지 않습니다. 사용자 승인
- 2026-09-14 **가입할 때 기본 얼굴을 채워 넣습니다** (6장 생체정보와 한 쌍).
  얼굴을 등록하지 않으면 예매가 막히는데, 1차 배포에서는 등록 단계를 밟지 않아도
  끝까지 가야 합니다. `Face.defaultFace()` 를 가입 시점에 넣어(`AuthService.signup`,
  `OauthService.completeSignup`) `faceRegistered` 를 true 로 만듭니다.
  🔴 **사람 얼굴에서 뽑은 값이 아닙니다.** 기본 "이미지" 한 장의 임베딩을 넣으면
     실존 인물의 생체 특징값이 모든 계정에 복사되고, 그 사진이 곧 **만능 열쇠**가 됩니다.
     대신 사람과 무관한 균일 단위 벡터를 쓰고, `model_version` 을 실제 모델과
     **다르게**(`bootstrap-default`) 둡니다.
  🔴 그래서 본인 확인은 대조를 **시도하지 않고** `USER_013`(FACE_MODEL_MISMATCH)로
     거절합니다 — "확인할 수 없음" 으로 끝나지 잘못 통과시키지 않습니다.
  ⚠️ 자리 표시는 재등록을 막지 않습니다(`Face.isDefault`). 막으면 실제 얼굴을 넣으려는
     사람이 `USER_007` 로 거절당해 삭제부터 해야 합니다. 진짜 얼굴이 등록된 뒤에는
     예전처럼 `USER_007` 로 막힙니다.
  기존 회원은 `V20260914_1600__add_default_face_for_existing_users.sql` 이 채웁니다. 사용자 요청
- 2026-09-15 **티켓이 얼굴을 가리키지 않고 베껴 둡니다** (6장 생체정보와 한 쌍).
  `tickets.face_id` 외래키 때문에 **예매를 한 번이라도 한 회원은 얼굴 삭제도 탈퇴도
  불가능했습니다** — `orphanRemoval` 이 `faces` 행을 지우려다 `fk_tickets_face` 에 막혔고,
  운영에서 `PSQLException` 으로 드러났습니다.
  원래 의도가 "예매 당시 얼굴을 티켓에 남긴다" 였으므로 포인터를 **복사본**으로 바꿨습니다
  (`V20260915_1000__copy_face_into_tickets.sql` — 백필 후 `face_id`·FK 제거).
  🔴 **기존 데이터는 잃지 않습니다.** `face_id` 가 NOT NULL + FK 라 모든 티켓이 실재하는
     얼굴 행을 가리키는 것이 제약으로 보장되고, 백필이 비면 `SET NOT NULL` 에서 마이그레이션이
     실패해 조용히 넘어가지 않습니다.
  🔴 **파기 범위가 두 곳이 됐습니다.** 탈퇴·얼굴 삭제로 `faces` 는 지워지지만
     `tickets.face_embedding` 의 복사본은 **남습니다**(사용자 결정). 같은 생체정보가
     예매 건수만큼 복사되므로, 나중에 전수 파기가 필요하면 이 컬럼도 함께 훑어야 합니다.
  ⚠️ **개인정보처리방침과 어긋납니다** — `PrivacyPolicyPage` 는 "탈퇴 또는 얼굴 삭제 요청 시
     즉시 파기" 라고 고지하고 있습니다. 지금은 `FEATURE.face = false` 라 그 문단이 화면에
     안 뜨지만, 얼굴을 되살리기 전에 **고지를 고치거나 동작을 되돌려야 합니다.**
     법률 자문이 아니므로 사람이 판단해야 합니다. 사용자 요청
