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
| **생체정보 처리 규칙** (7장) | 얼굴 원본 전송·저장, 임베딩 추출 위치 변경 |

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
| 차트 | **recharts** — 어드민(`/admin`) 전용 | 사용자 화면에 차트 넣기, 두 번째 차트 라이브러리 |
| 애니메이션 | **motion** (`motion/react`) + Tailwind transition | GSAP, react-spring |
| 결제 | **토스페이먼츠** (`@tosspayments/tosspayments-sdk`) | 다른 PG SDK 직접 호출, 프론트에서 금액 확정 |
| 얼굴 인식 | **onnxruntime-web** (`/wasm` 빌드 하나만) + INT8 ONNX 모델 | MediaPipe·tfjs 등 **두 번째 런타임**, FP32 모델 |

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

**한 데이터에는 주인이 하나입니다.** 지금 정해진 주인은 이렇습니다.

| 데이터 | 주인 | 바꾸는 법 |
|---|---|---|
| 내 정보(`User`) | `authKeys.me()` 쿼리 캐시 | `queryClient.setQueryData` 또는 invalidate |
| 캣머니 잔액 | `features/token` 의 `tokenKeys.balance()` | 잔액이 바뀌는 mutation 에서 invalidate |
| 내 포카 목록 | `features/nft` 의 `nftKeys.mine()` | 거래 mutation 에서 invalidate |

`authStore.userSnapshot` 은 새로고침 직후 한 프레임을 채우는 **사본**입니다.
`useAuth` 가 쿼리 → 스냅샷 한 방향으로만 베껴 씁니다. **직접 고치지 마세요.**
(예전에 `patchUser` 로 양쪽을 각각 고치다가 "얼굴 등록했는데 미등록으로 보이는" 문제가 났습니다)

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

> 🎨 **디자인과 레이아웃의 기준은 [`DESIGN.md`](DESIGN.md) 하나입니다.**
> 색·모션·컴포넌트뿐 아니라 **화면 뼈대·여백·터치 영역·노치·스크롤**까지 거기서 관리합니다.
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

- 폭은 `.app-width` 클래스 하나로 정합니다 (`--container-app` = 21rem/336px).
  **폰에서는 화면을 꽉 쓰고**, 480px(30rem)부터 폰 폭으로 고정돼 데스크톱에서도
  가운데 한 기둥으로 보입니다 — 새로 만드는 `fixed`·`portal` 요소에도
  `mx-auto app-width` 를 잊지 마세요. (DESIGN.md 5장)
- 터치 타겟 최소 44px → `Button` 은 `md` 이상
- 노치 대응: 상단 `pt-safe`, 하단 고정 요소 `pb-safe`
- 고정 하단 버튼이 있으면 본문에 그만큼 `padding-bottom` 을 줘서 안 가리게
- **승인된 예외:** `/admin/stadium` 좌석 배치 편집 화면은 대형 캔버스 작업이 필요하므로
  `AdminWorkspaceLayout`의 `max-w-7xl` 데스크톱 작업 폭을 사용합니다. 일반 사용자 화면과
  기존 `AppLayout`·`PlainLayout`의 `.app-width` 규칙은 변경하지 않습니다.

### 4-5. 애니메이션

- 지속시간·이징은 `shared/lib/motion.ts` 에서만 가져옵니다 (화면마다 새로 적지 않기)
- 상태 전환(hover, 열림/닫힘)은 Tailwind `transition-*` 으로 충분
- 리스트 등장은 `<Stagger>`. **화면 전환에는 연출을 넣지 않습니다** —
  화면 전체를 페이드하면 그 시간 동안 흰 바탕이 보여 깜빡임으로 읽힙니다 (DESIGN.md 3장)
- **페이지 전환에 `AnimatePresence` 를 쓰지 마세요** — exit 이 끝나지 않으면 네비게이션이 멈춥니다
- `prefers-reduced-motion` 을 존중 (`useReducedMotion` + `reduceIfNeeded`).
  단 **기능을 없애지 말고 정지 상태로 대체**하세요 — 안드로이드는 절전 모드만 켜도
  reduce 입니다. 손가락을 따라가는 직접 조작(끌어서 기울이기)은 끄지 않습니다.
- 티켓팅 화면(좌석 선택, 결제)에는 **지연을 만드는 애니메이션을 넣지 않습니다.** 속도가 곧 UX입니다
- 좌석 하나하나에 motion 컴포넌트를 붙이지 마세요 (수천 개 × 폴링 = 프레임 붕괴)

### 4-6. 색은 70 : 25 : 5

| 비율 | 역할 | 토큰 |
|---|---|---|
| **70** | 바탕 — 오프화이트 (순백 아님) | `--color-canvas`, `--color-surface-*` |
| **25** | 구조 — 글자·경계·어두운 면 (순검정 아님) | `--color-ink-*`, `--color-brand-*` |
| **5** | 강조 — 짙은 초록 `#3D5335` | `--color-accent-*` |

**초록을 쓰는 자리는 셋뿐입니다** — 지금 눌러야 할 것 / 지금 선택된 것 / 지금 진행 중인 것.
한 화면에 `primary` 버튼은 **하나**입니다. 둘이면 둘 다 안 눌립니다.

여기에 **큰 짙은 면** 하나가 더 있습니다 — 홈 상단·마이 상단·세그먼트 선택 알약.
넷 다 `.surface-strong` 이고, 색은 `--color-strong`(styles/index.css 의 `:root`)
**한 줄**에 있습니다. 🔴 화면 코드에 `bg-accent-700` 을 적지 마세요 —
그 순간 "한 곳에서 바꾸기" 가 깨집니다.

예외도 셋뿐입니다.

| 예외 | 어디 | 왜 |
|---|---|---|
| 붉은색 (경고) | 되돌릴 수 없는 동작 | 초록은 "누르세요", 붉은색은 "조심하세요" |
| 붉은색 (LIVE) | `Badge tone="live"` · `LiveDot` — "예매중" | 방송 LIVE 관습. **상태 칩 전용, 버튼 금지** |
| 좌석 상태 | 좌석맵·범례 (`--color-seat-*`) | 가용성은 색이 가장 빠른 신호 |

**이 밖에서는 색을 쓰지 마세요.** 늘리려면 0번 절차입니다.
바탕·글자는 **채도 0** 입니다. 중성색에 색기를 섞지 마세요.
좌석 색은 토큰 다섯 줄에 모여 있으니 **화면 코드에 색을 적지 말고 토큰을 고치세요.**
위계는 색이 아니라 **명도·굵기·여백**으로 만듭니다.
발광(glow)은 쓰지 않고 그림자·테두리로만 층을 만듭니다. (DESIGN.md 1·2·8장)
### 4-7. 되돌릴 수 없는 동작은 붉게

로그아웃·회원탈퇴·예매취소·대기취소·얼굴삭제·판매내리기는 **반드시**
`Button variant="danger" | "danger-ghost"` (또는 `ListRow danger`) + 확인 모달(`danger: true`)입니다.
일반 버튼과 같아 보이면 사고가 납니다. 자세한 목록은 DESIGN.md 1장.

---

## 5. 목업 데이터 (백엔드 연동 전)

`src/mocks/` 의 가짜 응답과 실제 서버가 **섞여 있습니다.**
회원·인증·얼굴은 실서버로 나가고, 나머지는 아직 목업입니다.

| 도메인 | 지금 |
|---|---|
| 회원가입·로그인·내 정보·비밀번호·닉네임·탈퇴 | **실서버** (`/auth/*`, `/users/me*`) |
| 자동 로그인(토큰 재발급)·SSAFY 계정 로그인 | **실서버** |
| 얼굴 등록·삭제 | **실서버** (`/users/me/face`) |
| 공연 목록·상세·회차, 공연 등록(관리자) | **실서버** (`/concerts/*`, `/schedules/*`, `/admin/concerts`, `/stadiums`) |
| 봇 확인(캡차) | 목업 (`mocks/handlers/auth.ts`) |
| 예매(구역·좌석·선점)·결제·주문 | **실서버** (`/schedules/*/seats`, `/performance-details/*/hold`, `/me/holds`, `/payments/ticket-orders*`) |
| 내 티켓·예매 취소 | **실서버** (`/users/me/tickets`, 취소는 `/payments/ticket-orders/{orderId}/cancel`) |
| 캣머니 잔액·배너 | **실서버** |
| 취소표(NRF)·앱정보 | 목업 (`mocks/handlers/resale.ts`, `appInfo.ts`) |
| 포카(포토카드) | **목업 — 서버 계약 기준** (`/nft-market/photocards`, `/photocards/*`, `/users/me/photocards*`). 타입·경로·에러 코드가 서버와 같아, 서버에 포카가 발행되면 `mocks/handlers/nft.ts` 만 지운다 |
| 경매 | **목업 — 서버 계약 기준** (`/nft-market/auctions`, `/auctions/*`, `/users/me/auctions`, `/users/me/bids`). 포카와 같은 규율. 서버에 경매가 생기면 `mocks/handlers/auction.ts` 만 지운다 |

⚠️ 남은 목업(취소표·포카·경매)은 `mocks/db.ts` 의 자체 ID(`s-1` …)를 씁니다. 실서버 ID 로 그 화면에
들어가면 404 가 납니다. 해당 도메인이 실서버로 바뀌면 함께 풀립니다.

🔴 **예매 취소는 티켓이 아니라 주문에 걸려 있습니다.** 카드 취소·캣머니 환급·NFT 소각이 한 주문에 묶여
있어서입니다. 티켓 응답의 `ticketOrderId` 로 `features/payment` 의 `useCancelOrder` 를 부르세요.
티켓 응답에 **금액이 없는 것도 같은 이유**입니다 — 금액은 주문 조회에 있습니다.

- 켜고 끄기: `.env.development` 의 `VITE_USE_MOCK`
- 동작: `shared/api/client.ts` 의 axios 어댑터를 가로챕니다.
  **화면·훅·api 파일은 목업의 존재를 전혀 모릅니다.**
- 핸들러에 없는 경로는 실제 네트워크로 나갑니다
  → 백엔드가 완성되는 순서대로 `mocks/handlers/` 에서 한 줄씩 지우면 점진적 연동이 됩니다.
- 🔴 **목업이 실서버 로그인을 알아보게 하는 다리가 하나 있습니다.**
  `mocks/handlers/auth.ts` 의 `requireUser` 는 실서버 JWT 를 보면 **시연용 목업 사용자**로
  이어 붙입니다. 그래야 아직 목업인 내 티켓·포카 화면이 빈 화면이 되지 않습니다.
  남은 도메인이 실서버로 바뀌면 이 다리도 함께 지웁니다.
- 백엔드가 다 되면 `src/mocks/` 폴더 삭제 + `main.tsx` 의 `setupMocks()` 한 줄 삭제로 끝납니다.

**목업을 쓴다고 `api/` 파일을 대충 쓰지 마세요.** 실제 스펙대로 작성하고 응답만 가짜입니다.

### 서버 쪽 규칙은 `server/CLAUDE.md` 가 기준입니다

응답 봉투, 에러 코드 체계(`AUTH_*` · `USER_*`), 인증 흐름은 백엔드 문서에 적혀 있습니다.
프론트에서 규칙을 새로 만들지 말고 그쪽을 먼저 보세요.

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

### 🔴 생체정보 처리 규칙 (절대 위반 금지)

이 프로젝트는 얼굴 인식을 사용하지만 **서버에 얼굴 이미지를 저장하지 않습니다.**
이 규칙을 바꾸려면 0번 절차입니다. 코드 리뷰에서 가장 먼저 보는 항목입니다.

- 얼굴 원본(`Blob` · `File` · base64 · dataURL · canvas 내용)을 **네트워크로 전송하는
  코드를 절대 작성하지 않습니다.** `fetch`/`axios`/`FormData` 에 이미지가 실리면 그건 버그입니다.
- 얼굴 → **임베딩 벡터 변환은 반드시 브라우저에서** 수행합니다.
- 서버로 나가는 건 **Float32Array 임베딩과 모델 버전 메타데이터뿐**입니다.
- 임베딩도 민감정보입니다(개인정보보호법 시행령 제18조).
  **로컬 로그·콘솔에 찍지 마세요.** 길이·차원 수까지만 찍어도 충분합니다.
- 원본 프레임은 **임베딩 추출 직후 해제**합니다 — canvas 초기화, `MediaStream` track 정리,
  `createObjectURL` 을 썼다면 짝이 되는 `revokeObjectURL`.
- **이 규칙과 충돌하는 요구가 들어오면 구현하지 말고 먼저 지적하세요.**

#### 성능 규칙

- 무거운 인식 모델을 **매 프레임 돌리지 않습니다.**
  가벼운 검출기만 저 fps(5fps)로 돌려 가이드 UI 를 그리고,
  **임베딩 추출은 캡처 시점에 1회만** 실행합니다.
- 모든 추론은 **Web Worker** 에서. 메인 스레드 블로킹 금지 — 좌석·결제 화면과 같은 규칙입니다.
- 모델 파일은 **Cache API** 로 캐싱해 재방문 시 재다운로드가 없게 합니다.
  (서비스워커 precache 에 넣지 마세요 — 용량이 커서 첫 설치가 통째로 느려집니다)

#### 용량 규칙

- **WASM 런타임은 하나만.** onnxruntime-web 의 `/wasm` 서브패스만 씁니다.
  MediaPipe·tfjs 를 함께 넣으면 런타임을 두 벌 받게 되고, 그건 설계 실패입니다.
  검출도 인식도 **같은 런타임의 ONNX 모델**로 처리합니다.
- 모델은 **INT8 양자화본**. onnxruntime-web 이 INT8 연산자를 지원하는 걸 확인했습니다(SFace 세션 생성 OK).
- 모델·런타임은 **카메라를 켤 때부터** 받습니다. 화면 진입만으로 4.5MB 를 태우지 마세요.
- ORT 런타임(13MB)은 빌드 후 `scripts/compress-wasm.mjs` 가 `.wasm.gz` 를 만들고
  워커가 그걸 받아 풉니다. **호스트의 압축 설정에 기대지 않습니다.**
- 🔴 **모델은 커밋하지 않으므로 빌드가 준비합니다.** `npm run build` 맨 앞의
  `npm run models` 가 없으면 받아서 sha256 을 검증합니다 (못 받으면 빌드 실패).
  배포에 모델이 빠지면 SPA 폴백이 index.html 을 200 으로 주고, onnxruntime 은
  그 HTML 을 protobuf 로 읽으려다 `ERROR_CODE: 7 ... protobuf parsing failed` 로 죽습니다.
  그래서 `/models/` 는 **SPA 폴백에서 제외**하고(없으면 404), 워커는 받은 바이트가
  ONNX 인지(`0x08`) 확인한 뒤에만 세션을 만들고 Cache API 에 넣습니다.
  모델을 바꿀 때는 `scripts/fetch-face-models.mjs` 의 해시와
  `VITE_FACE_MODEL_VERSION` 을 **함께** 올리세요 — 임베딩은 모델이 같아야 대조됩니다.
- 라이브러리나 모델을 늘리기 전에 전송량을 **다시 재세요.**
  (첫 진입 5MB 목표는 SFace INT8 9.9MB 때문에 **보류**. 정확도 우선 → 경량화는 이후 과제)

### 얼굴 등록은 마이페이지에서 한 번만

예매할 때마다 얼굴을 찍는 게 아닙니다. **마이페이지에서 한 번 등록**해 두면
예매한 티켓에 그 얼굴이 매칭되고, 입장할 때 대조합니다.

- 미등록이면 예매 진입을 막습니다 (`RequireFace`).
  단, 예매 흐름 한가운데서 카메라를 켜라고 하지 말고 **마이페이지로 보냅니다.**
  (`ROUTES.MY` + `state: { faceRequired: true }` → 마이페이지가 이유를 안내)
- 공연 상세의 예매 버튼은 가드에 맡기지 말고 **먼저 모달로 알려줍니다.**
  화면만 휙 바뀌면 왜 못 들어갔는지 알 수 없습니다.
- 로그인·가입 직후에 얼굴 등록으로 끌고 가지 않습니다. 그 자리에서 이탈합니다.
- 얼굴 **삭제**는 되돌릴 수 없는 동작입니다 — `danger` 버튼 + 확인 모달. (4-7)
- 등록이 끝나면 **완료 화면**(`ROUTES.FACE_DONE`)을 거칩니다. 토스트 한 줄로 지나가면
  "등록이 된 건가?" 가 남아 같은 화면을 또 찾아옵니다. 원래 가려던 곳(가드가 넘겨준
  `state.from`)은 완료 화면이 들고 있다가 "이어서 진행하기" 로 보냅니다.

### 로그인은 이메일, SSAFY 계정도 됩니다

- 로그인 식별자는 **이메일**입니다. (예전 `loginId` 는 없어졌습니다)
- 표시 이름은 `nickname` 입니다. 티켓 수령인을 지정할 때도 이 값을 씁니다.
- 액세스 토큰은 헤더로, **리프레시 토큰은 httpOnly 쿠키**로 오갑니다.
  프론트는 리프레시 토큰을 볼 수 없고, 401 이 나면 인터셉터가 조용히 재발급합니다.

### 회원가입은 자동 로그인시키지 않습니다

가입 성공 → `/signup/done` (완료 화면) → 사용자가 직접 로그인.
가입과 로그인이 한 번에 일어나면 "가입이 된 건가?" 하고 헷갈립니다.

**예외는 SSAFY 계정 가입 하나입니다.** 이미 SSAFY 로그인을 한 번 거친 사람이라
`/oauth/signup` 에서 닉네임·전화번호만 채우면 그대로 로그인 상태가 됩니다.
여기서 또 로그인을 시키면 방금 한 인증을 두 번 하는 셈입니다.

### 예매 진입 관문 — 봇 확인(캡차)

예매 시작 전 한 단계는 **자동입력 방지**입니다. 휴대폰 인증번호가 아닙니다.
여기서 걸러내려는 건 "본인인지"가 아니라 **"사람인지"** 입니다.

- 서버가 **그림만** 내려줍니다. 정답은 서버만 압니다 —
  응답에 정답을 담는 순간 캡차가 아니게 됩니다.
- 한 번 쓴 문제는 정답이든 오답이든 버립니다 (재사용·대입 방지).
- 통과하면 그 회차 예매가 끝날 때까지 유지됩니다 (`captchaVerifiedFor`).
- 진짜 검증은 서버가 합니다 — 좌석 선점 API 가 `CAPTCHA_REQUIRED` 를 던집니다.

### 동시 결제 / 좌석 락

진짜 락은 **서버**가 잡습니다. 프론트에서 "누가 먼저 눌렀나"를 판정하려 하지 마세요.
프론트의 방어는 셋입니다 (`features/booking/hooks/useSeatHold.ts` 참고):

1. 요청을 한 번만 — `Button loading` + mutation `retry: false` + `Idempotency-Key`
2. 락 실패를 곱게 — `SEAT_ALREADY_HELD` 시 좌석맵 갱신 + 선택 해제
3. 만료를 정확히 — 서버가 준 `expiresAt` 기준 카운트다운
   (`setInterval` 로 숫자를 깎으면 백그라운드 탭에서 밀립니다 → `useCountdown`)

결제 멱등키는 **플로우 시작 시 한 번 만들어 재시도에도 재사용**합니다.
매번 새로 만들면 멱등키의 의미가 없습니다.

### 결제 (토스페이먼츠)

프론트가 하는 일은 **결제창 호출과 인증까지**입니다. 승인은 백엔드가 합니다.

1. `POST /payments/prepare` — **서버가** 금액과 `orderId` 를 확정
2. `payment.requestPayment()` — 결제창에서 사용자 인증
3. `POST /payments/confirm` — 백엔드가 토스 승인 API 호출 → 티켓 발급

**금액을 프론트에서 계산해 결제창에 넣고 그대로 믿으면 안 됩니다.**
요청을 조작해 1원 결제를 만들 수 있습니다. 금액의 출처는 항상 서버입니다.
승인 단계에서 프론트가 보내는 `amount` 도 주소창에서 온 값이라,
백엔드가 저장된 금액과 비교한 뒤 **저장된 금액으로** 승인해야 합니다.

- 결제수단은 **간편결제(토스)** 와 **캣머니(포인트)** 둘뿐입니다.
  캣머니는 PG 를 타지 않습니다 — 결제창도 리디렉션도 없이 서버가 잔액을 차감합니다.
  화면이 보여주는 캣머니 개수는 어림값이고 **차감량은 서버가 확정**합니다.
  (`POINT_UNIT_KRW` 는 표시용 환산 단위일 뿐, 결제 요청에 실어 보내지 마세요)
- PG SDK 의존은 `features/payment` 안에만 둡니다. 화면은 `usePayment` 만 압니다.
- `VITE_PAYMENT_MODE=auto` (기본) — `VITE_TOSS_CLIENT_KEY` 가 채워져 있으면 실제 결제창,
  비어 있으면 모의 결제. 키만 넣으면 코드 수정 없이 실제 테스트 결제창이 뜹니다.
- **클라이언트 키는 두 종류이고 서로 호환되지 않습니다.**
  | 키 | 짝이 되는 SDK | 화면 |
  |---|---|---|
  | `test_ck_...` (API 개별 연동) | `tossPayments.payment()` | 팝업 결제창 |
  | `test_gck_...` (**결제위젯**) | `tossPayments.widgets()` | 페이지에 삽입 |
  잘못 짝지으면 *"결제위젯 연동 키는 지원하지 않습니다"* 로 거절됩니다.
  가입 없이 쓸 수 있는 공개 테스트 키가 **위젯 키뿐**이라 이 프로젝트는 위젯을 씁니다.
- 결제위젯은 팝업이 아니라 **페이지 안에 삽입**됩니다.
  본문에 그대로 붙이면 화면이 500px 쯤 길어지고 눌러야 할 것들과 겹칩니다.
  그래서 **시트**(`TossPaymentSheet`)에 담아 결제할 때만 화면을 덮습니다.
- 키 종류는 `env.payment.widgetKey` 가 접두사로 자동 판별합니다.
  개별 연동 키를 넣으면 코드 수정 없이 **토스가 띄우는 새 창**으로 바뀝니다.
- 🔴 **시크릿 키(`test_gsk_...` / `test_sk_...`)는 절대 프론트에 두지 마세요.**
  `VITE_` 값은 번들에 그대로 박혀 브라우저에서 누구나 읽습니다.
  승인용 시크릿 키는 **백엔드 환경변수**입니다.
- **토스는 성공 시 항상 `successUrl` 로 페이지를 이동**시킵니다.
  결과를 받는 라우트(`BOOKING_PAYMENT_RESULT`)는 **얼굴·봇 확인 가드 밖**에 둬야 합니다.
  가드에 막히면 "돈은 빠졌는데 티켓이 없는" 사고가 납니다.
- 예매 플로우 스토어는 sessionStorage 에 유지됩니다. 리디렉션 복귀 때 살아 있어야 하기 때문입니다.
- 토스 규격을 어기면 결제창이 아예 안 열립니다 — `orderId` 6~64자(영문·숫자·`-`·`_`),
  `orderName` 100자 이내, 전화번호는 숫자만.

### 1인 1매

현재 정책은 개발·배포 모두 **1인 1매**(`VITE_MAX_TICKETS_PER_USER=1`)입니다.
**이 숫자를 코드에 적지 마세요.** 서버가 준 `maxPerUser` → 없으면 `env.maxTicketsPerUser` 순으로 씁니다.

### 실시간 데이터

좌석·대기열은 `staleTime: 0` + 폴링입니다. WebSocket 이 붙으면 훅 내부만 바꾸고
화면 코드는 건드리지 않습니다.

### 배포

- **`VITE_USE_MOCK` 을 배포에서 끄지 마세요** (남은 도메인이 실서버로 바뀌기 전까지).
  끄면 예매·티켓·포카가 전부 404 가 됩니다.
- 회원·인증·얼굴은 이제 **실서버**입니다. 배포본에서 로그인이 되려면 `/api` 요청이 백엔드로
  가도록 프록시(nginx rewrite / `vercel.json`)를 걸어야 합니다.
  **개발 서버의 `/api` 프록시는 배포 환경에 없습니다.**
- 리프레시 토큰 쿠키는 프론트와 API 의 도메인이 다르면 `SameSite=None; Secure` 여야 갑니다.
  백엔드에도 허용 origin 을 등록해야 합니다 (`server/CLAUDE.md` 인증 흐름).
- SPA 폴백이 없으면 `/login` 직접 진입·새로고침이 404 입니다.
  `public/_redirects`(Netlify) / `vercel.json`(Vercel) 은 이미 있고,
  nginx·S3 는 직접 설정해야 합니다. (README 9장)
- `sw.js` / `manifest.webmanifest` 는 **캐시 금지**. 캐시되면 새 배포가 전달되지 않습니다.
- 얼굴 등록(카메라)·PWA 설치·결제창은 **HTTPS 에서만** 동작합니다.
- 배포 전 `npm run preview` 로 운영 빌드를 확인하세요. dev 가 돌아도 배포본은 깨질 수 있습니다.

### 알림 (웹 푸시)

지금은 **앱이 열려 있는 동안만** 알림이 뜹니다.

| | 상태 |
|---|---|
| 권한 요청 · 알림 표시 | ✅ 됨 (`features/notification`) |
| 당첨 감시 | ✅ 폴링 60초 (`ResaleWinNotifier`, 권한 없으면 요청도 안 보냄) |
| **앱이 닫혀 있을 때 서버 푸시** | ❌ 백엔드 VAPID 키 + 서비스워커 push 핸들러 필요 |

- 권한 요청은 **사용자가 버튼을 누른 직후에만** 하세요.
  화면 진입 시 자동으로 물어보면 대부분 차단을 누르고, 한 번 차단되면
  앱에서 되돌릴 수 없습니다(브라우저 설정에서 직접 풀어야 함).
- 모바일 크롬은 `new Notification()` 을 막아 두었습니다 —
  서비스워커의 `showNotification` 을 먼저 시도합니다. (model 에 이미 처리)
- iOS 는 **홈 화면에 설치한 PWA 에서만** 알림이 됩니다 (16.4+).
- 알림을 여러 개 쌓지 마세요. 같은 종류는 `tag` 로 덮어쓰거나 하나로 묶습니다.

### PWA

서비스워커가 **API 응답을 캐싱하지 않도록** `NetworkOnly` 로 막아뒀습니다.
캐시된 좌석 잔여를 보여주면 대형 사고입니다. 이 설정을 풀지 마세요(0번 절차).

### 어드민 콘솔 (`/admin`) — 4-4 모바일 우선의 **유일한 예외**

`/admin` 아래는 **데스크톱 전용**입니다. 앱 화면과 레이아웃 규칙이 다릅니다.

| | 앱 화면 (`/`, `/concerts` …) | 어드민 콘솔 (`/admin/**`) |
|---|---|---|
| 폭 | `.app-width` 한 기둥 (21rem) | 화면 꽉 (사이드바 + 본문) |
| 레이아웃 | `AppLayout` / `PlainLayout` | `features/admin` 의 `AdminLayout` |
| 좁은 화면 | 폰이 기준 | `lg` 미만에서 **안내 문구만** 띄웁니다 |
| 모달 폭 | `Modal width="app"` (기본) | `Modal width="wide"` |

- 반응형으로 접지 않습니다. 어설프게 접으면 폰에서 쓸 수 있는 것처럼 보이는데
  실제로는 표가 안 읽힙니다. **안 되는 걸 안 된다고 알려주는 쪽**이 낫습니다.
- 껍데기는 `shared/components/layout` 이 아니라 `features/admin/components` 에 있습니다.
  사이드바가 역할로 메뉴를 걸러야 해서 도메인(`features/auth`)을 알아야 하고,
  `shared` 는 도메인을 모릅니다(3-2).
- **메뉴 추가는 세 곳**입니다: `shared/constants/routes.ts` 경로 →
  `AdminSidebar` 의 `ADMIN_MENU` 한 줄 → `app/router/router.tsx` 의 admin 자식 라우트.
- 사이드바의 어두운 면은 70:25:5 의 **25(구조)** 입니다. `brand` 는 채도 0 이라
  초록(강조 5%)을 잡아먹지 않습니다. **선택된 메뉴 하나만** 초록입니다.
- 접근 권한은 `features/auth` 의 `can.accessAdmin`(콘솔 진입) /
  `can.manageUsers`(회원 관리)에 있습니다. 🔴 서버 권한과 **같아야** 합니다 —
  서버가 403 을 주는 메뉴를 보여주면 눌렀을 때 실패하는 화면이 됩니다.
  지금 서버의 `/admin/**` 은 전부 ADMIN 전용입니다.

---

## 8. 아직 확정 안 된 것 (백엔드/기획과 합의 필요)

정하지 않고 코드에 가정으로 박아두지 말고, 여기에 적어두고 사용자에게 알리세요.

- [x] 응답 봉투 — `{ success, data, message, code }` **확정** (`shared/types/api.ts`)
- [x] 에러 코드 — 서버가 도메인별로 관리합니다 (`AUTH_001~`, `USER_001~`).
      목록은 `server/CLAUDE.md` 3-2 를 보세요. `shared/api/ApiError.ts` 의 `ERROR_CODE` 는
      네트워크 오류처럼 **서버가 못 준 경우**를 위한 프론트 전용 값입니다
- [x] 인증 — **확정**. 액세스 토큰(1시간, 헤더) + 리프레시 토큰(14일, httpOnly 쿠키, 재발급 시 회전)
- [x] API 프리픽스 — 서버 context-path 가 `/api` 입니다. `VITE_API_BASE_URL=/api` 를 그대로 씁니다
- [x] 얼굴 임베딩 수신 API — `POST /users/me/face` `{ embedding: number[128], modelVersion: string }`.
      **원본 이미지를 받는 엔드포인트는 만들지 않습니다** (7장 생체정보 규칙)
- [x] 임베딩 모델·차원 — **YuNet 2023mar + SFace 2021dec INT8 / 128차원** (실측). 게이트 검표도 **같은 모델**이어야 대조가 됩니다
- [x] SSAFY OAuth — 연동 완료. 버튼 → `/auth/oauth/ssafy/authorize` 로 페이지 이동 →
      복귀는 `/oauth/callback`, 처음이면 `/oauth/signup` 에서 닉네임·전화번호를 받습니다.
      **인가 코드 교환은 백엔드가 합니다** — client_secret 을 프론트에 두지 마세요
- [ ] 캣머니 잔액 — 서버가 아직 `catBalance: null` 을 줍니다 (지갑·블록체인 연동 후 확정).
      화면에 보이는 잔액은 여전히 목업 값입니다
- [ ] 캡차 — 아직 목업입니다 (현재 5글자 / 3분). 실서버는 이미지 렌더링 방식도 정해야 함
- [ ] 토스페이먼츠 **상점 계약** — 지금은 문서용 공개 테스트 키(`test_gck_docs_...`)로 동작
- [ ] 캣머니 ↔ 원 환산율 (현재 `POINT_UNIT_KRW = 100` 가정)
- [ ] 가상계좌·계좌이체 재도입 여부 (현재 화면에서 제외, 웹훅 미구현)
- [ ] 예매 수수료 정책 (현재 매당 2,000원 가정)
- [x] 결제 취소·환불 API — **확정**. `POST /payments/ticket-orders/{id}/cancel` 이 카드 전액 취소 +
      캣머니 환급 + NFT 소각까지 합니다. 좌석은 추첨 풀이 아니라 **바로 AVAILABLE** 로 돌아갑니다.
      부분 취소는 없습니다 (1인 1매라 나눌 것이 없음)
- [ ] **웹 푸시** — 백엔드 VAPID 키 + 발송 API, 서비스워커 `push` 핸들러
      (지금은 앱이 열려 있을 때만 알림이 뜹니다. `injectManifest` 로 바꿔야 하므로 0번 절차)
- [ ] 배포 버전 API — `GET /app/version` 응답 형태 (`features/appInfo` 에 가정해 둠)
- [ ] 모델 파일 호스팅 위치 — 지금은 자체 호스팅 `public/models/` (커밋 제외,
      빌드가 OpenCV Zoo 에서 받아 해시 검증). CDN 이전 여부와 버전 표기 규칙
      (CDN 을 쓰면 `VITE_FACE_*_URL` 을 절대 주소로 두면 끝입니다)
- [ ] 라이브니스(위조 방지) — 이번 단계 제외, 다음 작업
- [ ] 좌석맵 좌표 데이터 형식 (공연장별)
- [ ] 실시간 통신 (WebSocket / SSE)
- [ ] NRF 추첨 결과 통지 방식 (메일 + 인앱?)
- [ ] 티켓 QR 규격 (플로우차트 주석: "QR은 추후 논의")
- [ ] 토큰 벌기 / 순발력 컨텐츠 내용 (현재 `features/token` 은 빈 계획)

---

## [규칙 변경 이력]

- 2026-09-07 `/admin/stadium` 좌석 배치 편집 화면에 한해 `AdminWorkspaceLayout` 데스크톱 작업 폭 허용 (사용자 승인)
- 2026-09-03 회원·인증·얼굴 API 실서버 연동에 맞춰 5장(목업 현황)·7장(로그인 식별자·SSAFY)·
  배포·8장 갱신. SSAFY 계정 로그인 화면(`/oauth/callback`, `/oauth/signup`) 추가
| 2026-09-03 | 하단 탭 하이라이트를 알약 → **원**(`size-10`)으로, 탭 사이를 미끄러져 이동 (원 하나만 두고 `인덱스 × 100%` 이동) | 사용자 요청 |
- 2026-09-07 공연 목록·상세·회차 실서버 연동에 맞춰 5장(목업 현황) 갱신. `features/concert` 타입을 서버 응답으로 교체,
  `features/organizer` 에 공연 등록(관리자) 추가, `can.createConcert` 를 서버와 같은 ADMIN 전용으로 조정
- 2026-09-08 포카 목업을 서버 `NftController` 계약으로 재작성(5장 현황표 갱신). `features/nft` 타입·경로 교체,
  화면 6곳 필드 정렬, `shared/hooks/useInfiniteScroll` 추가. 경매는 다음 브랜치
- 2026-09-08 **어드민 콘솔(`/admin`) 추가** — 7장에 "어드민 콘솔" 절 신설.
  4-4(모바일 우선)의 유일한 예외로 데스크톱 전용 레이아웃을 도입했고
  (`features/admin` 의 `AdminLayout`, `lg` 미만은 안내만),
  `Modal` 에 `width="wide"` 변형을 한 줄 추가했습니다.
  `can.accessAdmin` / `can.manageUsers` 권한 판단을 `permission.ts` 에 추가. 사용자 요청
- 2026-09-08 포카 경매 프론트 착수. `features/auction` 추가(포카와 나란히, 카드 그림만 배럴로 공유),
  마켓 구매 탭 안에 상점·경매 **글자 탭**(DESIGN.md 10장), 잔액 표시를 `available` 로 전환,
  `shared/lib/parseServerTime` 추가(서버가 타임존 없는 KST 를 주므로 카운트다운이 어긋나지 않게)
- 2026-09-10 예매·결제·내 티켓 실서버 연동 마무리 (5장 현황표 갱신). `features/ticket` 을 서버
  `MyTicketResponse` 규격으로 교체(`/users/me/tickets`), 예매 취소를 `features/payment` 의
  `useCancelOrder`(주문 기준)로 옮김. 서버가 선점을 들고 있는 동안 화면이 이어받도록
  `useMyHolds`/`useResumeHold`/`ResumeBookingCard` 추가. `mocks/handlers/ticket.ts` 삭제
- 2026-09-09 **recharts 추가** (1장 기술 스택). 어드민 통계 대시보드의 꺾은선 그래프용입니다.
  자체 SVG 로도 선은 그리지만 툴팁·축 라벨·배포 마커선(`ReferenceLine`)까지 직접 만들면
  지표가 늘 때마다 유지비가 붙습니다. **어드민(`/admin`) 화면에서만** 씁니다 —
  사용자 화면에 넣지 마세요(데스크톱 전용이라 번들 부담을 감수한 것입니다).
  차트는 `features/admin/components` 안에만 두고, 페이지는 그걸 조립만 합니다. 사용자 승인
