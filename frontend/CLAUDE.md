# CLAUDE.md — 티캣 프론트엔드 공통 규칙

> 이 파일은 **Claude Code가 이 저장소에서 작업할 때 반드시 따라야 하는 규칙**입니다.
> 팀원 여러 명이 각자 Claude로 작업하기 때문에, 이 문서가 유일한 기준입니다.

---

## 🔴 0. 규칙 변경 절차 (가장 중요)

**이 파일에 적힌 규칙은 Claude가 임의로 바꿀 수 없습니다.**

아래에 해당하는 작업을 요청받으면 **작업을 멈추고 사용자에게 먼저 물어보세요.**

| 변경 대상 | 예시 |
|---|---|
| 이 `CLAUDE.md` 자체 | 규칙 추가/수정/삭제 |
| `DESIGN.md` (디자인 시스템) | 팔레트·모션 강도·의미 색상 규칙 변경 |
| 폴더 구조 | 새 최상위 폴더, feature 내부 폴더 구성 변경 |
| 상태관리 전략 | Zustand ↔ Redux, TanStack Query 제거 등 |
| 라이브러리 추가/교체 | 새 npm 패키지 설치, UI 라이브러리 도입 |
| ESLint 규칙 완화 | `no-restricted-imports` 해제, `eslint-disable` 광범위 사용 |
| API 통신 방식 | `shared/api/client.ts` 의 인터셉터/봉투 구조 |
| 디자인 토큰 | `styles/index.css` 의 `@theme` 색·폰트 체계 |
| 라우팅 구조 | 가드 정책, 레이아웃 체계 |
| 배포/환경변수 체계 | `.env.*`, `vite.config.ts` 빌드 설정 |

### 물어볼 때 이 형식을 그대로 쓰세요

```
⚠️ 공통 규칙 변경이 필요한 작업입니다.

- 바꾸려는 것: (무엇을)
- 이유: (왜 필요한지)
- 영향 범위: (다른 팀원 코드에 어떤 영향이 있는지)
- CLAUDE.md 해당 조항: (몇 번 규칙인지)

이 변경, 프론트 개발 리드와 상의하셨나요?
- 예 → 리드가 승인한 내용을 알려주시면 CLAUDE.md도 함께 갱신하겠습니다.
- 아니오 → 리드 확인 후 진행하는 걸 권합니다. 지금은 규칙 안에서 가능한 대안으로 우회할까요?
```

**사용자가 "그냥 해"라고 하면** — 그 판단은 사용자 몫이므로 진행합니다.
단, 다음 두 가지를 반드시 함께 하세요.

1. `CLAUDE.md` 를 같은 커밋에서 갱신 (규칙과 코드가 어긋나면 다음 사람이 혼란)
2. 변경 요약을 아래 **[규칙 변경 이력]** 에 한 줄 추가

> 규칙 **안에서** 하는 일반 작업(페이지 추가, 모달 추가, feature 구현, 버그 수정,
> 스타일 조정)은 물어볼 필요 없이 그냥 하면 됩니다. 위 표에 없으면 자유입니다.

---

## 1. 기술 스택 (변경 시 위 0번 절차)

| 영역 | 선택 | 쓰지 말 것 |
|---|---|---|
| 프레임워크 | React 19 + Vite + TypeScript | Next.js |
| 스타일 | Tailwind CSS **v4** (CSS-first, `tailwind.config.js` 없음) | styled-components, CSS Modules |
| 서버 상태 | TanStack Query v5 | 컴포넌트 안 `useEffect` + `axios` |
| 클라이언트 상태 | Zustand v5 | Redux, Recoil, Context 전역 상태 |
| 라우팅 | React Router v7 (`createBrowserRouter`) | |
| HTTP | axios (`shared/api/client.ts` 래퍼만 사용) | 컴포넌트에서 `fetch` 직접 호출 |
| 아이콘 | **lucide-react** | emoji 하드코딩, 다른 아이콘 팩 |
| 애니메이션 | **motion** (`motion/react`) + Tailwind transition | GSAP, react-spring |

---

## 2. 폴더 구조와 의존 방향

```
pages  →  features  →  shared
  ↑          ↑           ↑
  └───────  app  ────────┘
```

| 레이어 | 역할 | 규칙 |
|---|---|---|
| `app/` | 부트스트랩, 라우터, 프로바이더, 모달 레지스트리 | 모든 레이어를 알아도 됨 |
| `pages/` | 라우트 진입점. **조립만** | 로직 금지 |
| `features/` | 도메인별 수직 분할. **실제 작업 공간** | 다른 feature 는 배럴로만 |
| `shared/` | 도메인을 모르는 공용 코드 | `features`/`pages`/`app` import **금지** |
| `mocks/` | 목업 데이터 (백엔드 완성 시 폴더째 삭제) | 다른 곳에서 import 금지 |

### feature 내부 = MVC

```
features/<도메인>/
├── model/       M  타입 + 순수 비즈니스 규칙 (React import 금지)
├── api/         M  서버 통신 + 쿼리 키
├── store/       M  Zustand 클라이언트 상태
├── hooks/       C  화면과 모델을 잇는 로직
├── components/  V  그리기만 함
└── index.ts        공개 API (배럴)
```

**모든 feature 가 이 구조를 그대로 따릅니다.** 폴더를 늘리거나 이름을 바꾸지 마세요(0번 절차).
안 쓰는 폴더는 `.gitkeep` 만 두고 비워둡니다.

---

## 3. 절대 규칙 (ESLint 가 강제함)

### 3-1. feature 내부를 직접 import 하지 않는다

```ts
import { bookingApi } from '@/features/booking/api/bookingApi';  // ❌
import { useSeatMap } from '@/features/booking';                  // ✅
```

배럴에 없으면 **그 feature 의 `index.ts` 에 export 를 추가**하고 쓰세요.

### 3-2. `shared` 는 도메인을 모른다

`shared/` 안에서 `@/features/**`, `@/pages/**`, `@/app/**` 을 import 하면 에러입니다.
도메인 지식이 필요해졌다면 그 코드는 `features` 로 가야 한다는 뜻입니다.
(HTTP 클라이언트가 토큰이 필요한 문제는 `shared/api/authBridge.ts` 의존성 역전으로 이미 풀려 있습니다)

### 3-3. `import.meta.env` 직접 사용 금지

```ts
import { env } from '@/shared/config';   // ✅ 유일한 통로
env.maxTicketsPerUser;
```

새 환경변수는 `.env.example` + `vite-env.d.ts` + `shared/config/env.ts` 세 곳을 함께 수정합니다.

### 3-4. 서버 데이터를 Zustand 에 넣지 않는다

| 어디에 있나 | 누가 관리 | 예 |
|---|---|---|
| 서버 | **TanStack Query** | 좌석 현황, 공연 목록, 내 티켓, NFT 목록 |
| 화면 | **Zustand** | 선택한 좌석, 모달 스택, 토큰, 진행 중인 예매 플로우 |

서버 데이터를 스토어에 복사하면 캐시가 두 벌이 되고 반드시 어긋납니다.

### 3-5. 하드코딩 금지

```ts
navigate(`/concerts/${id}`)            // ❌
navigate(ROUTES.CONCERT_DETAIL(id))    // ✅  shared/constants/routes.ts

className="bg-[#7C3AED]"               // ❌
className="bg-brand-500"               // ✅  styles/index.css 의 @theme

<span>🎫</span>                        // ❌
<Ticket size={20} />                   // ✅  lucide-react
```

### 3-6. 페이지에 로직을 쓰지 않는다

페이지가 하는 일은 넷뿐입니다:
**URL 파라미터 꺼내기 → feature 훅 호출 → 로딩/에러 분기 → 컴포넌트 배치.**

페이지 파일에 `axios`, `useMutation`, `useQuery` 가 보이면 feature 로 옮기세요.

---

## 4. UI 작성 규칙

> 🎨 **색·모션·컴포넌트의 구체적인 규칙은 [`DESIGN.md`](DESIGN.md) 에 있습니다.**
> UI 를 만들기 전에 반드시 읽으세요. 아래는 그중 어겨서는 안 되는 것만 추린 것입니다.

### 4-1. 공용 컴포넌트를 먼저 찾는다

새 버튼/입력/카드를 만들기 전에 `shared/components/ui/` 를 확인하세요.
있으면 쓰고, 변형이 필요하면 **컴포넌트 안의 variant 테이블에 한 줄 추가**합니다.
비슷한 컴포넌트를 새로 만드는 건 금지입니다.

```tsx
// Button.tsx — 변형은 이렇게 테이블로 관리
const VARIANT: Record<Variant, string> = {
  primary: '...',
  secondary: '...',
  // 새 변형이 필요하면 여기에 한 줄
};
```

### 4-2. 컴포넌트는 `className` prop 을 받아 `cn()` 으로 병합한다

```tsx
export function Card({ className, ...rest }: CardProps) {
  return <div className={cn('surface rounded-2xl border p-4', className)} {...rest} />;
}
```

이게 있어야 바깥에서 여백/크기를 조정할 수 있고, 안 그러면 래퍼 `div` 가 계속 늘어납니다.

### 4-3. 도메인 컴포넌트는 서버를 모른다

`features/*/components/` 안의 컴포넌트는 **props 로 받은 것만** 씁니다.
`useQuery` 를 컴포넌트 안에서 부르지 마세요 — 훅에서 받아 페이지가 내려줍니다.
(스토리북·테스트에 목 데이터만 꽂으면 바로 확인되는 상태를 유지)

### 4-4. 모바일 우선

- 컨테이너 최대 폭은 `max-w-screen-sm` (레이아웃이 이미 적용)
- 터치 타겟 최소 44px → `Button` 은 `md` 이상
- 노치 대응: 상단 `pt-safe`, 하단 고정 요소 `pb-safe`
- 고정 하단 버튼이 있으면 본문에 그만큼 `padding-bottom` 을 줘서 안 가리게

### 4-5. 애니메이션

- 지속시간·이징은 `shared/lib/motion.ts` 에서만 가져옵니다 (화면마다 새로 적지 않기)
- 상태 전환(hover, 열림/닫힘)은 Tailwind `transition-*` 으로 충분
- 리스트 등장은 `<Stagger>`, 라우트 진입은 `<PageTransition>` (레이아웃에 이미 적용)
- **페이지 전환에 `AnimatePresence` 를 쓰지 마세요** — exit 이 끝나지 않으면 네비게이션이 멈춥니다
- `prefers-reduced-motion` 을 존중 (`useReducedMotion` + `reduceIfNeeded`)
- 티켓팅 화면(좌석 선택, 결제)에는 **지연을 만드는 애니메이션을 넣지 않습니다.** 속도가 곧 UX입니다
- 좌석 하나하나에 motion 컴포넌트를 붙이지 마세요 (수천 개 × 폴링 = 프레임 붕괴)

### 4-6. 색을 쓰지 않는다

무채색(블랙 & 화이트) 시스템입니다. **붉은색만 예외**입니다 — 되돌릴 수 없는 동작.
위계는 색이 아니라 **명도·굵기·여백**으로 만듭니다.
발광(glow)은 쓰지 않고 그림자·테두리로만 층을 만듭니다.
공연 포스터·포토카드 아트는 서로 구분돼야 해서 색을 유지합니다. (DESIGN.md 1·2·8장)

### 4-7. 되돌릴 수 없는 동작은 붉게

로그아웃·회원탈퇴·예매취소·대기취소·얼굴삭제·판매내리기는 **반드시**
`Button variant="danger" | "danger-ghost"` (또는 `ListRow danger`) + 확인 모달(`danger: true`)입니다.
일반 버튼과 같아 보이면 사고가 납니다. 자세한 목록은 DESIGN.md 1장.

---

## 5. 목업 데이터 (백엔드 연동 전)

현재 백엔드가 없어서 `src/mocks/` 의 가짜 응답을 봅니다.

- 켜고 끄기: `.env.development` 의 `VITE_USE_MOCK`
- 동작: `shared/api/client.ts` 의 axios 어댑터를 가로챕니다.
  **화면·훅·api 파일은 목업의 존재를 전혀 모릅니다.**
- 핸들러에 없는 경로는 실제 네트워크로 나갑니다
  → 백엔드가 완성되는 순서대로 `mocks/handlers/` 에서 한 줄씩 지우면 점진적 연동이 됩니다.
- 백엔드가 다 되면 `src/mocks/` 폴더 삭제 + `main.tsx` 의 `setupMocks()` 한 줄 삭제로 끝납니다.

**목업을 쓴다고 `api/` 파일을 대충 쓰지 마세요.** 실제 스펙대로 작성하고 응답만 가짜입니다.

---

## 6. 작업 절차 (Claude가 지킬 것)

1. **작업 전** — 관련 feature 의 `index.ts` 와 `model/` 을 먼저 읽고 기존 타입·규칙을 재사용합니다.
2. **작업 중** — 위 3장 절대 규칙을 어기지 않습니다. 어겨야만 풀리는 문제라면 0번 절차.
3. **작업 후** — 아래를 실행하고 **통과한 것만** 완료로 보고합니다.

```bash
npm run typecheck && npm run lint
```

4. **보고** — 무엇을 만들었고, 무엇을 가정했고, 무엇이 미완인지 명시합니다.
   테스트가 실패했으면 실패했다고 그대로 말합니다.

### 커밋

- 브랜치: `feat/<도메인>-<작업>` (예: `feat/booking-seat-select`)
- 메시지: `feat(booking): 좌석 선택 화면 구현` — 한글 본문, 타입은 영어
- `main` / `master` 에 직접 커밋하지 않습니다

---

## 7. 이 프로젝트 특유의 주의사항

### 동시 결제 / 좌석 락

진짜 락은 **서버**가 잡습니다. 프론트에서 "누가 먼저 눌렀나"를 판정하려 하지 마세요.
프론트의 방어는 셋입니다 (`features/booking/hooks/useSeatHold.ts` 참고):

1. 요청을 한 번만 — `Button loading` + mutation `retry: false` + `Idempotency-Key`
2. 락 실패를 곱게 — `SEAT_ALREADY_HELD` 시 좌석맵 갱신 + 선택 해제
3. 만료를 정확히 — 서버가 준 `expiresAt` 기준 카운트다운
   (`setInterval` 로 숫자를 깎으면 백그라운드 탭에서 밀립니다 → `useCountdown`)

결제 멱등키는 **플로우 시작 시 한 번 만들어 재시도에도 재사용**합니다.
매번 새로 만들면 멱등키의 의미가 없습니다.

### 1인 1매

배포 정책은 1인 1매(`VITE_MAX_TICKETS_PER_USER=1`), 개발은 4매입니다.
**이 숫자를 코드에 적지 마세요.** 서버가 준 `maxPerUser` → 없으면 `env.maxTicketsPerUser` 순으로 씁니다.

### 실시간 데이터

좌석·대기열은 `staleTime: 0` + 폴링입니다. WebSocket 이 붙으면 훅 내부만 바꾸고
화면 코드는 건드리지 않습니다.

### PWA

서비스워커가 **API 응답을 캐싱하지 않도록** `NetworkOnly` 로 막아뒀습니다.
캐시된 좌석 잔여를 보여주면 대형 사고입니다. 이 설정을 풀지 마세요(0번 절차).

---

## 8. 아직 확정 안 된 것 (백엔드/기획과 합의 필요)

정하지 않고 코드에 가정으로 박아두지 말고, 여기에 적어두고 사용자에게 알리세요.

- [ ] 응답 봉투 형태 — 현재 `{ success, data, message, code }` 가정 (`shared/types/api.ts`)
- [ ] 에러 코드 문자열 — `shared/api/ApiError.ts` 의 `ERROR_CODE`
- [ ] 인증 — accessToken(헤더) + refreshToken(httpOnly 쿠키) 가정
- [ ] OTP 발송 채널 (문자/이메일)과 유효시간
- [ ] 얼굴 인식 라이브러리 및 전송 포맷
- [ ] 좌석맵 좌표 데이터 형식 (공연장별)
- [ ] 실시간 통신 (WebSocket / SSE)
- [ ] NRF 추첨 결과 통지 방식 (메일 + 인앱?)
- [ ] 티켓 QR 규격 (플로우차트 주석: "QR은 추후 논의")
- [ ] 토큰 채굴 / 순발력 컨텐츠 내용 (현재 `features/token` 은 빈 계획)

---

## 규칙 변경 이력

| 날짜 | 변경 내용 | 승인 |
|---|---|---|
| 2026-08-27 | 최초 작성 | — |
| 2026-08-27 | 아이콘 `lucide-react`, 애니메이션 `motion` 도입 | 사용자 승인 |
| 2026-08-27 | `src/mocks/` axios 어댑터 목업 체계 도입 | 사용자 승인 |
| 2026-08-27 | 예매 플로우를 OTP → 구역 → 좌석 → 확인 → 결제 5단계로 확정 (플로우차트) | 사용자 승인 |
| 2026-08-27 | 디자인 개편 — 다크 고정, 보라/청록 팔레트, 의미 색상 규칙. `DESIGN.md` 신설 | 사용자 승인 |
| 2026-08-27 | 서비스명 `티캣` 확정. 발광 축소 · AI 클리셰 제거 · 대비 상향 | 사용자 승인 |
| 2026-08-27 | 고양이 로고·마스코트, 캔버스 밝기 상향, 스크롤바 전역 숨김, `features/banner` 추가 | 사용자 승인 |
| 2026-08-27 | 다크 → **무채색 라이트** 전환. 붉은색만 예외, 홈 검정/하양 경계 히어로 | 사용자 승인 |
