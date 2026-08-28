# 티캣 — Frontend

**티캣**은 얼굴 인증과 블록체인 추첨으로 암표를 막는 티켓 예매 서비스입니다. 이 저장소는 프론트엔드입니다.
React 19 · Vite · TypeScript · Tailwind v4 · TanStack Query · Zustand · PWA

> 🤖 **Claude Code 로 작업하는 분은 [`CLAUDE.md`](CLAUDE.md) 를 먼저 읽어주세요.**
> 팀 공통 규칙이 정리돼 있고, 규칙을 바꾸려면 리드 확인이 필요합니다.
>
> 🎨 **UI 를 만들기 전에는 [`DESIGN.md`](DESIGN.md) 를 읽어주세요.**
> 색·모션·컴포넌트 사용 규칙이 정리돼 있습니다.

---

## 1. 처음 시작하기

### 준비물

| 도구 | 버전 | 확인 |
|---|---|---|
| Node.js | **20.19 이상** (22 LTS 권장) | `node -v` |
| npm | 10 이상 | `npm -v` |
| Git | — | `git --version` |

> Node 가 없으면 [nodejs.org](https://nodejs.org) 에서 LTS 를 설치하세요.
> 여러 버전을 오갈 일이 있으면 [fnm](https://github.com/Schniz/fnm) 이나 nvm 을 추천합니다.

### 클론부터 실행까지

```bash
git clone <저장소-주소>
```

```bash
cd S15P21A402/frontend
```

```bash
npm install
```

```bash
npm run dev
```

터미널에 뜨는 **http://localhost:5173** 을 브라우저에서 열면 끝입니다.

### 바로 로그인해보기

백엔드가 아직 없어서 **목업 데이터**로 동작합니다. 아래 계정으로 로그인하세요.

| 구분 | 값 |
|---|---|
| 아이디 / 비밀번호 | `ssafy` / `ssafy1234` |
| 관리자 계정 | `admin` / `admin1234` |
| 예매 진입 확인 | **캡차** — 화면에 뜬 그림의 글자를 입력 (정답은 서버만 압니다) |
| 얼굴 등록 | 마이페이지 → 얼굴 등록 관리 (한 번만, 예매 시 자동 매칭) |

> 이 정보는 앱 실행 시 브라우저 콘솔에도 출력됩니다.
> 목업 데이터는 **새로고침하면 초기화**됩니다 (항상 같은 상태에서 시작하기 위함).

### 한번 따라가 볼 만한 흐름

```
가입 → 로그인 → **마이페이지에서 얼굴 등록** → 공연 → 회차 예매 → 봇 확인(캡차)
→ 구역 → 좌석 → 확인 → 결제 → 완료
```

---

## 2. 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (HMR) |
| `npm run build` | **운영** 빌드 → `dist/` |
| `npm run build:dev` | 개발 설정으로 빌드 (스테이징 확인용) |
| `npm run preview` | 빌드 결과를 로컬에서 서빙 — **배포 전 반드시 여기서 확인** |
| `npm run build:pages` | GitHub Pages 용 빌드 (404.html 생성) |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run typecheck` | 타입 검사 |
| `npm run format` | Prettier |

**커밋/PR 전에는 반드시:**

```bash
npm run typecheck && npm run lint
```

### 휴대폰 실기기에서 보기

`npm run dev` 후 터미널에 뜨는 `Network:` 주소로 같은 와이파이에서 접속하면 됩니다.
단, **카메라(얼굴 등록)와 PWA 설치는 HTTPS 또는 localhost 에서만** 동작합니다.
실기기에서 그 기능들까지 테스트하려면 배포하거나 터널링(ngrok 등)을 쓰세요.

---

## 3. 환경 분리 (개발 / 배포)

| 파일 | 언제 쓰이나 | 커밋 |
|---|---|---|
| `.env.development` | `npm run dev`, `build:dev` | O (팀 공유값) |
| `.env.production` | `npm run build` | O (팀 공유값) |
| `.env.local` | 개인 로컬 오버라이드 | **X** |
| `.env.example` | 어떤 키가 필요한지 문서 | O |

**규칙 1.** `VITE_` 가 붙은 값은 **번들에 그대로 박혀 브라우저에 노출**됩니다.
시크릿 키·결제 secret·DB 비번은 절대 넣지 마세요.

**규칙 2.** 코드에서 `import.meta.env` 를 **직접 쓰지 않습니다.**
전부 [`src/shared/config/env.ts`](src/shared/config/env.ts) 를 거칩니다.
오타가 나면 배포 후 런타임이 아니라 앱 시작 시점에 터집니다.

```ts
import { env } from '@/shared/config';
env.maxTicketsPerUser; // dev=4, prod=1
```

개발/운영이 다른 값:

| 키 | dev | prod | 의미 |
|---|---|---|---|
| `VITE_APP_VERSION` | 0.1.0 | 0.1.0 | 설정 > 앱 정보에 표시. `package.json` 과 함께 올리세요 |
| `VITE_MAX_TICKETS_PER_USER` | 1 | 1 | 1인 최대 구매 매수 |
| `VITE_USE_MOCK` | true | **true** | 목업 — 백엔드 붙기 전까지 배포본도 켜둠 |
| `VITE_ENABLE_DEVTOOLS` | true | false | React Query Devtools |
| `VITE_PAYMENT_MODE` | auto | auto | 토스 클라이언트 키가 있으면 실제 결제위젯, 없으면 모의 |

> 💳 **토스 결제는 바로 됩니다.** `.env` 에 토스가 공개한 문서용 테스트 클라이언트 키
> (`test_gck_docs_...`)가 들어 있어 가입 없이 실제 결제 UI 가 뜹니다.
>
> 🔴 문서에 같이 적힌 **시크릿 키(`test_gsk_...`)는 프론트에 넣지 마세요.** 승인 API 전용이고,
> `VITE_` 값은 번들에 박혀 브라우저에서 그대로 읽힙니다. 백엔드 환경변수에만 둡니다.

> ⚠️ `VITE_USE_MOCK` 을 prod 에서 `false` 로 두면 **배포한 사이트가 아무것도 안 됩니다.**
> 개발 서버의 `/api` 프록시는 배포에 없어서 모든 API 요청이 실패합니다.
> 백엔드가 붙은 뒤에 끄세요.

스테이징이 필요해지면 `.env.staging` 을 만들고 `vite build --mode staging` 을 추가하면 됩니다. 코드 수정은 필요 없습니다.

---

## 4. 목업 데이터 (백엔드 연동 전)

백엔드가 없어도 화면을 전부 만들 수 있도록 `src/mocks/` 가 가짜 응답을 돌려줍니다.

### 어떻게 동작하나

axios 의 **어댑터**(실제로 네트워크를 타는 부분)를 갈아 끼웁니다.
그래서 **화면·훅·`api/` 파일은 목업의 존재를 전혀 모릅니다.**

```
useSeatMap()  →  bookingApi.seatMap()  →  http.get('/schedules/s-1/seats')
                                              ↓
                                    [ 목업 어댑터가 가로챔 ]
                                              ↓
                                    src/mocks/handlers/booking.ts
```

등록되지 않은 경로는 **실제 네트워크로 나갑니다.**
→ 백엔드가 완성되는 순서대로 `src/mocks/handlers/` 에서 핸들러를 하나씩 지우면 점진적으로 연동됩니다.

### 백엔드가 완성되면 (제거 절차)

1. `.env.*` 에서 `VITE_USE_MOCK` 제거
2. `src/main.tsx` 의 `setupMocks()` 블록 삭제
3. `src/mocks/` 폴더 삭제

끝입니다. **화면·훅·api 파일은 하나도 안 건드립니다.**

운영 빌드에서는 `import.meta.env.VITE_USE_MOCK === 'true'` 가 빌드 시점에 `false` 로 치환되어
목업 코드가 **번들에 아예 들어가지 않습니다.**

### 목업 폴더 구조

```
src/mocks/
├── router.ts       경로 매칭 + axios 어댑터
├── db.ts           인메모리 시드 데이터 (공연/좌석/티켓/NFT…)
├── handlers/       도메인별 핸들러 — 백엔드 완성 순서대로 지우면 됨
│   ├── auth.ts     로그인/가입/캡차/얼굴
│   ├── concert.ts  공연 목록·상세
│   ├── booking.ts  구역/좌석/선점락/결제
│   ├── ticket.ts   내 티켓/취소
│   ├── resale.ts   취소표 추첨 대기
│   ├── nft.ts      포토카드 마켓/토큰
│   ├── banner.ts   홈 배너
│   └── payment.ts  결제 준비/승인
└── index.ts        setupMocks()
```

> **목업이라고 `api/` 파일을 대충 쓰지 마세요.** 실제 스펙대로 작성하고 응답만 가짜입니다.

---

## 5. 폴더 구조

```
src/
├── app/          앱을 "조립"하는 층 — 부트스트랩, 라우터, 프로바이더
│   ├── providers/    AppProvider, QueryProvider, 모달 시스템
│   ├── router/       router.tsx, guards.tsx
│   └── pwa/          서비스워커 업데이트 배너
│
├── shared/       도메인을 모르는 공용 코드 — 다른 프로젝트에 갖다 놔도 동작
│   ├── api/          axios 인스턴스, ApiError, queryClient
│   ├── config/       env.ts (환경변수 단일 진입점)
│   ├── components/   ui/ · layout/ · common/
│   ├── hooks/        useCountdown, useMediaQuery, useReducedMotion
│   ├── lib/          cn, 포맷터, storage
│   ├── stores/       modalStore, toastStore
│   ├── constants/    ROUTES, STALE_TIME
│   └── types/        ApiEnvelope 등 공통 타입
│
├── features/     도메인별 수직 분할 — 여기가 실제 작업 공간
│   ├── auth/         로그인·가입·캡차·권한
│   ├── face/         얼굴 등록 (카메라/업로드)
│   ├── concert/      공연 목록·상세·회차
│   ├── booking/      구역·좌석·선점락·결제   ← 참고 구현
│   ├── ticket/       내 티켓·QR·취소
│   ├── resale/       취소표 NRF 추첨 대기
│   ├── nft/          포토카드 마켓·토큰
│   ├── banner/       홈 상단 광고·이벤트 배너
│   ├── payment/      결제 (토스페이먼츠)
│   ├── notification/ 웹 알림 (추첨 당첨)
│   ├── appInfo/      앱 버전 · 업데이트 안내
│   └── organizer/ monitoring/ map/ (골격만)
│
├── pages/        라우트 진입점. "조립"만 하고 로직은 없음
├── mocks/        목업 (백엔드 완성 시 삭제)
└── styles/       index.css (디자인 토큰)
```

### 왜 `features/` 로 나누나

화면(pages) 기준으로 나누면 여러 명이 같은 파일을 동시에 고치게 됩니다.
**도메인 기준으로 나누면 담당자별로 폴더가 갈려서 충돌이 거의 안 납니다.**

### feature 안의 MVC

모든 feature 가 **같은 5개 폴더**를 갖습니다. 남의 폴더를 열어도 어디에 뭐가 있는지 바로 압니다.

| 폴더 | MVC | 역할 | 예시 |
|---|---|---|---|
| `model/` | **M** | 타입 + 순수 비즈니스 규칙 (React 없음) | `seat.model.ts` — 좌석 선택 가능 판정 |
| `api/` | **M** | 서버 통신 + 쿼리 키 | `bookingApi.ts` |
| `store/` | **M** | 클라이언트 상태 (Zustand) | `bookingStore.ts` — 선택한 좌석 |
| `hooks/` | **C** | 화면과 모델을 잇는 로직 | `useSeatHold.ts` — 락 + 타이머 |
| `components/` | **V** | 그리기만 함 | `SeatMap.tsx` |
| `index.ts` | — | **공개 API.** 밖에서는 여기 있는 것만 씀 | |

**참고 구현은 [`src/features/booking`](src/features/booking) 을 보세요.**
좌석 조회 → 선택 규칙 → 서버 락 → 만료 타이머 → 수령인 지정 → 결제까지 한 사이클이 다 들어 있습니다.

---

## 6. 지켜야 할 규칙

자세한 내용과 근거는 [`CLAUDE.md`](CLAUDE.md) 에 있습니다. 요약하면:

1. **feature 내부를 직접 import 하지 않는다** — `@/features/booking` (배럴)만
2. **의존 방향은 한쪽으로** — `pages → features → shared`, `shared` 는 위를 모름
3. **서버 데이터는 TanStack Query, 화면 상태만 Zustand**
4. **페이지에 로직을 쓰지 않는다** — URL 파싱 → 훅 호출 → 로딩/에러 분기 → 배치
5. **경로·색·아이콘을 하드코딩하지 않는다** — `ROUTES`, `@theme`, `lucide-react`

1·2번은 ESLint 가 강제합니다. 어기면 빌드 전에 에러로 잡힙니다.

---

## 7. 자주 하는 작업

### 페이지 추가

1. `src/pages/XxxPage.tsx` 생성 (`export function XxxPage()`)
2. `shared/constants/routes.ts` 에 경로 추가
3. `app/router/router.tsx` 에 라우트 한 줄 (lazy + 레이아웃/가드 선택)

### 모달 추가

1. 모달 컴포넌트를 해당 feature `components/` 에 만들고 `index.ts` 에서 export
2. `app/providers/modals/registry.ts` 의 `ModalPropsMap` 에 한 줄
3. 같은 파일 `MODAL_REGISTRY` 에 한 줄

이후 어디서든 — 페이지 컴포넌트는 손대지 않습니다. `onClose` 는 자동 주입됩니다.

```tsx
const { open } = useModal();
open('common/confirm', { title: '예매를 취소할까요?', danger: true, onConfirm: cancel });
```

### 목업 API 추가

`src/mocks/handlers/<도메인>.ts` 에 한 줄 등록하면 끝입니다.

```ts
mock('GET', '/schedules/:scheduleId/sections', (ctx) => {
  return sections.filter((s) => s.scheduleId === ctx.params.scheduleId);
});
```

### feature 추가

`src/features/<이름>/` 아래 `api model store hooks components` + `index.ts`.
[`features/booking`](src/features/booking) 을 복사해 이름만 바꾸는 게 가장 빠릅니다.

---

## 8. 디자인 시스템

**전체 규칙은 [`DESIGN.md`](DESIGN.md) 에 있습니다.** UI 를 만들기 전에 읽어주세요.

짧게 요약하면:

- **다크 고정 + 네온** (OS 설정을 따라가지 않습니다). 브랜드는 네온 퍼플, 보조는 네온 시안
- 색·그림자·모션은 전부 [`src/styles/index.css`](src/styles/index.css) 의 `@theme` 토큰. **하드코딩 금지**
- 🔴 **되돌릴 수 없는 동작(로그아웃·탈퇴·예매취소·얼굴삭제)은 반드시 붉은 계열 + 확인 모달**
- 공용 컴포넌트는 [`src/shared/components/ui/`](src/shared/components/ui). 새로 만들기 전에 먼저 찾고,
  변형이 필요하면 컴포넌트 안 variant 테이블에 한 줄 추가
- 아이콘은 **lucide-react** 만 (이모지 하드코딩 금지)
- 모션 지속시간은 [`shared/lib/motion.ts`](src/shared/lib/motion.ts) 에서만 가져오기
- 티켓팅 화면(좌석·결제)에는 **지연을 만드는 애니메이션 금지.** 속도가 곧 UX

---

## 9. 배포

```bash
npm run build
```

```bash
npm run preview
```

**`npm run dev` 가 잘 돌아도 배포본은 깨질 수 있습니다.** 배포 전에 `preview` 로 확인하세요.

### 반드시 해야 하는 두 가지

**1. SPA 폴백** — 이 앱은 주소를 브라우저가 처리합니다. 서버에 `/login` 이라는 파일이
없으니, 그 주소를 직접 열거나 새로고침하면 **404** 가 납니다.

| 호스팅 | 설정 |
|---|---|
| Netlify / Cloudflare Pages | `public/_redirects` ✅ 포함됨 |
| Vercel | `vercel.json` ✅ 포함됨 |
| GitHub Pages | `npm run build:pages` ✅ |
| nginx | `try_files $uri $uri/ /index.html;` ⚠️ 직접 |
| S3 + CloudFront | 403·404 → `/index.html` (200) ⚠️ 직접 |

**2. HTTPS** — 아래 기능은 `http://` 에서 조용히 실패합니다.

- 얼굴 등록 (카메라 = `getUserMedia`)
- PWA 설치 (서비스워커)
- 결제 인증 (대부분의 PG 가 HTTPS 요구)

### 캐시 주의

`sw.js` 와 `manifest.webmanifest` 는 **캐시하지 마세요**(`no-cache`).
캐시되면 새 배포가 사용자에게 며칠씩 전달되지 않습니다.
`/assets/` 는 파일명에 해시가 붙으므로 오래 캐시해도 안전합니다.

nginx 전체 설정과 결제 연동 방법은 [`DESIGN.md`](DESIGN.md) 11·12장에 있습니다.

---

## 10. 이 프로젝트 특유의 주의사항

### 동시 결제 / 좌석 락

진짜 락은 **서버가** 잡습니다. 프론트에서 "누가 먼저 눌렀나"를 판정하려는 시도는 전부 틀립니다.
프론트의 역할은 셋 — [`useSeatHold.ts`](src/features/booking/hooks/useSeatHold.ts) 주석 참고.

1. **요청을 한 번만** — `Button loading` + mutation `retry: false` + `Idempotency-Key`
2. **락 실패를 곱게** — `SEAT_ALREADY_HELD` 시 좌석맵 갱신 + 선택 해제
3. **만료를 정확히** — 서버가 준 `expiresAt` 기준 카운트다운

결제 멱등키는 **플로우 시작 시 한 번 만들어 재시도에도 재사용**합니다
(`bookingStore.ensureIdempotencyKey()`). 매번 새로 만들면 멱등키의 의미가 없습니다.

### 타이머는 숫자를 깎지 않는다

[`useCountdown`](src/shared/hooks/useCountdown.ts) 은 렌더할 때마다 `expiresAt - now` 를 다시 잽니다.
`setInterval` 로 1씩 깎으면 **백그라운드 탭에서 throttling 돼 카운트가 밀립니다.**
좌석 타이머가 밀리면 "화면엔 3분 남았는데 서버는 이미 만료" 가 됩니다.

### 실시간 데이터

좌석·구역 현황은 `staleTime: 0` + 폴링입니다.
WebSocket 이 붙으면 훅 내부만 소켓 구독으로 바꾸면 되고 **화면 코드는 안 바뀝니다.**

### PWA

- 서비스워커가 **API 응답을 캐싱하지 않도록** `NetworkOnly` 로 막아뒀습니다
  (캐시된 좌석 잔여를 보여주면 대형 사고)
- 새 버전 배포 시 [`PwaUpdatePrompt`](src/app/pwa/PwaUpdatePrompt.tsx) 가 업데이트 배너를 띄웁니다
- 개발 중 서비스워커는 꺼져 있습니다 — 캐시 때문에 디버깅이 지옥이 됩니다.
  테스트하려면 `npm run build && npm run preview`
- **아이콘 파일이 아직 없습니다** → [`public/icons/README.md`](public/icons/README.md)

### 모바일

- 컨테이너 최대 폭 `max-w-screen-sm`, 터치 타겟 최소 44px
- 노치 대응: 상단 `pt-safe`, 하단 고정 요소 `pb-safe`
- 하단 고정 버튼이 있으면 `<BottomBar.Spacer />` 로 본문 가림 방지

---

## 11. 아직 확정 안 된 것

백엔드/기획과 합의가 필요합니다. 정하지 않고 코드에 가정으로 박아두지 마세요.

- [ ] 응답 봉투 형태 — 현재 `{ success, data, message, code }` 가정 ([`shared/types/api.ts`](src/shared/types/api.ts))
- [ ] 에러 코드 문자열 — [`shared/api/ApiError.ts`](src/shared/api/ApiError.ts) 의 `ERROR_CODE`
- [ ] 인증 — accessToken(헤더) + refreshToken(httpOnly 쿠키) 가정
- [ ] 캡차 난이도·유효시간 (현재 5글자 / 3분)
- [ ] 얼굴 인식 라이브러리 및 전송 포맷
- [ ] 좌석맵 좌표 데이터 형식 (공연장별)
- [ ] 실시간 통신 (WebSocket / SSE)
- [ ] NRF 추첨 결과 통지 방식 (메일 + 인앱?)
- [ ] 티켓 QR 규격 — 플로우차트 주석 "QR은 추후 논의"
- [ ] 토큰 채굴 / 순발력 컨텐츠 내용 (`/token` 은 잔액 조회만)
- [ ] 티켓팅 개설(소속사), 티켓 지도 — `features/organizer`, `features/map` 골격만
