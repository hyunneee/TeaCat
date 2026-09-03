# 티캣 블록체인 서비스

티캣의 온체인 로직입니다. 블록체인을 처음 다루는 사람 기준으로 썼습니다.

> **설계와 규칙은 [`DESIGN.md`](DESIGN.md) 하나입니다.** 작업 전에 읽어주세요.
> 모르는 용어가 나오면 [11장 용어집](DESIGN.md#11-용어집)에 30개쯤 정리해뒀습니다.

---

## 1. 이게 뭔가

이 폴더 안에는 **성격이 다른 프로그램 두 개**가 들어 있습니다.

| | 무엇 | 어디서 도나 | 언제 만지나 |
|---|---|---|---|
| `contracts/` | 블록체인 **위에** 올라가는 코드 (Solidity) | 이더리움 체인 | 티켓·토큰의 규칙을 바꿀 때 |
| `api/` | 블록체인에 **말을 거는** 서버 (TypeScript) | Node.js | Spring 이 호출할 기능을 만들 때 |

둘의 관계는 이렇습니다.

```
[Spring]  ──HTTP──▶  [api]  ──서명한 트랜잭션──▶  [체인]  ──▶  [contracts 가 실행됨]
```

`contracts` 는 한 번 배포하면 체인 위에서 알아서 돌고, `api` 는 그걸 **부르는** 쪽입니다.
데이터베이스는 없습니다 — 저장은 전부 Spring 이 합니다.
([DESIGN.md 1장](DESIGN.md#1-이-서비스의-경계))

---

## 2. 처음 시작하기

### 준비물

| | 버전 | 확인 |
|---|---|---|
| Node.js | 20.19 이상 (22 LTS 권장) | `node -v` |
| npm | 10 이상 | `npm -v` |

### 설치

`blockchain/` 폴더에서 이거 하나면 끝입니다.

```bash
npm install
```

두 폴더가 함께 설치되고, **`.env` 도 자동으로 만들어집니다.**
니모닉·오퍼레이터 키·내부 API 키를 무작위로 생성하므로 손으로 채울 값이 없습니다.
이미 `.env` 가 있으면 건드리지 않으니 여러 번 돌려도 안전합니다.

| | 커밋 | 무엇 |
|---|---|---|
| `.env.example` | 함 | **설명서.** 각 변수가 무엇이고 틀리면 무슨 일이 나는지. 값은 비어 있습니다 |
| `.env` | 안 함 | 실제 값. `npm install` 이 만듭니다 |

키 형태의 값은 커밋되는 파일에 두지 않습니다. 공개 테스트 키라도 마찬가지입니다 —
그 자리에 진짜 키를 넣는 사람이 반드시 생깁니다.

> 니모닉이 사람마다 다르므로 **유저 주소도 팀원마다 다릅니다.**
> 문서의 예시 주소와 자기 화면이 다른 건 정상입니다.
> 키를 새로 뽑고 싶으면 `rm .env && npm run setup:env`.

주의: 여기서 만들어진 키는 **개발 전용**입니다. 운영에는 쓰지 마세요.
`NODE_ENV=production` 이면 서버가 개발 흔적(`CHAIN_ID=31337` 등)을 감지해 기동을 거부합니다.

### 실행

체인은 이미 떠 있습니다 (SSAFY 체인). 서버만 띄우면 됩니다.

```bash
npm run dev
```

파일을 저장하면 자동으로 다시 뜹니다.

### 확인

```bash
curl http://localhost:4000/health
```

```json
{
  "status": "ok",
  "txSender": "relayer",
  "chain": { "connected": true, "expectedChainId": 31221, "actualChainId": 31221, "blockNumber": 11170378, "network": "ssafy" },
  "operator": { "address": "0xaeac…", "balanceEth": "0.0", "gasIsFree": true },
  "contracts": {},
  "warnings": []
}
```

`status: "ok"` 에 `warnings` 가 비어 있으면 **세팅 완료**입니다. 안 되면 `warnings` 가 알려줍니다.

> **`balanceEth` 가 `0.0` 인데 정상입니다.** SSAFY 체인은 가스가 무료라(`gasIsFree: true`)
> 잔고를 채우지 않아도 트랜잭션이 나갑니다. 잔고 경고는 가스가 유료인 체인에서만 뜹니다.

| warnings 내용 | 할 일 |
|---|---|
| 체인에 연결되지 않았습니다 | 네트워크 확인. `.env` 의 `RPC_URL` 확인 |
| chainId 불일치 | `.env` 의 `CHAIN_ID` 가 `31221` 인지 확인 |
| 배포한 계정과 오퍼레이터가 다릅니다 | 아래 "공용 체인이라는 것" 참고 |

`contracts` 가 비어 있는 건 정상입니다 — 아직 배포한 컨트랙트가 없습니다.
`npm run deploy:ssafy` 로 배포하면 여기에 주소가 찍힙니다.

### API 문서 (Swagger)

서버를 띄우면 열립니다.

```
http://localhost:4000/docs
```

**지금 실제로 도는 엔드포인트만 있습니다.** 내부 API 명세서에 있고 여기 없는 것은
아직 구현 전입니다 — Swagger 에 보이는데 404 가 나는 상황을 만들지 않기 위해서입니다.

- `Authorize` 버튼에 `.env` 의 `INTERNAL_API_KEY` 를 넣으면 화면에서 바로 호출됩니다
- 원본 OpenAPI 문서는 `http://localhost:4000/docs.json` — Postman 으로 가져가거나
  클라이언트 코드 생성에 씁니다

> **운영(`NODE_ENV=production`)에서는 열리지 않습니다.** 이 프로세스는 오퍼레이터
> 개인키와 마스터 니모닉을 쥐고 있어서, 내부 API 의 생김새를 밖에 광고할 이유가 없습니다.
> 운영에서도 봐야 한다면 리버스 프록시에서 사내망으로만 열어주세요.

문서는 **컨트롤러가 검증에 쓰는 zod 스키마를 그대로** 가져다 씁니다. 응답 형태도
타입과 대조해서, 어긋나면 `npm run typecheck` 가 깨집니다. 문서만 옛날 것으로 남는 일이 없습니다.

지갑 파생도 확인해봅니다. `x-internal-key` 에는 `.env` 의 `INTERNAL_API_KEY` 값을 넣습니다.

```bash
curl -X POST http://localhost:4000/internal/wallets -H "Content-Type: application/json" -H "x-internal-key: <.env 의 INTERNAL_API_KEY>" -d "{\"derivationIndex\":0}"
```

같은 인덱스로 몇 번을 불러도 **항상 같은 주소**가 나옵니다.
어딘가에 저장해둔 걸 꺼내오는 게 아니라, 니모닉으로 그 자리에서 계산하기 때문입니다.

---

## 3. 체인 — SSAFY 체인을 씁니다

로컬 체인이 아니라 **이미 돌고 있는 공용 체인**에 붙습니다.

| | 값 |
|---|---|
| RPC | `https://rpc.ssafy-blockchain.com` |
| chainId | `31221` |
| 클라이언트 | Besu v22.7.2 (PoA, 블록 약 10초) |
| 가스 | **무료** (`gasPrice = 0`) |
| EVM | **Constantinople** |

로컬 체인과 다른 점이 네 가지 있고, 넷 다 코드에 영향을 줍니다.

**1. 가스가 무료입니다.** 오퍼레이터 잔고가 `0` 이어도 트랜잭션이 나갑니다.
계정에 자금을 채우는 절차가 없습니다. `/health` 도 이 체인에서는 잔고 0 을 경고하지 않습니다.

**2. 블록이 10초입니다.** 로컬처럼 즉시 확정되지 않습니다.
**"보내고 바로 읽기" 는 깨집니다.** 트랜잭션은 반드시 2단계로 다루세요 —
보내고(`PENDING`), 나중에 영수증을 확인합니다. ([DESIGN.md 4-2](DESIGN.md#4-2))

**3. EVM 이 Constantinople 입니다.** 이게 가장 많이 걸립니다.
아래 옵코드가 이 체인에는 **없습니다.**

| 옵코드 | 도입 | 영향 |
|---|---|---|
| `CHAINID` · `SELFBALANCE` | Istanbul | `block.chainid` 를 못 씁니다 → EIP-712 서명 불가 |
| `BASEFEE` | London | `block.basefee` 를 못 씁니다. EIP-1559 트랜잭션도 없습니다 |
| `PUSH0` | Shanghai | solc 0.8.20+ 가 **기본으로 넣습니다** |
| `MCOPY` · `TSTORE` | Cancun | OpenZeppelin 최신 버전이 씁니다 |

그래서 `hardhat.config.ts` 의 `evmVersion` 이 `constantinople` 로 내려가 있습니다.
**이걸 올리지 마세요.** 올리면 컴파일은 통과하는데 배포가 실패합니다 —
solc 가 `0` 을 `PUSH0` 으로 넣어서 생성자 첫 줄에서 죽습니다.

같은 이유로 `@openzeppelin/contracts` 가 `5.1.0` 에 **고정**되어 있습니다.
5.2 부터 `Strings.sol` 이 `mcopy` 를 쓰는 `Bytes.sol` 을 끌고 오는데,
그러면 `constantinople` 로는 아예 컴파일이 안 됩니다. `^` 를 붙이지 마세요.

**4. 공용 체인입니다.** 팀원과 다른 교육생이 같이 씁니다.

- 배포한 컨트랙트는 **남습니다.** 체인을 껐다 켜는 개념이 없습니다.
  잘못 배포해도 되돌릴 수 없고, 다시 배포하면 옛 컨트랙트가 체인에 그대로 남습니다.
- 배포 주소는 팀이 공유하므로 `deployments/ssafy.json` 을 **커밋합니다.**

### 오퍼레이터 키는 팀이 하나를 공유합니다

공용 체인에서는 **배포한 계정이 그 컨트랙트의 admin** 입니다.
각자 다른 키를 쓰면 남이 배포한 컨트랙트의 `onlyOwner` 함수가 막힙니다.
그래서 `OPERATOR_PRIVATE_KEY` 만 팀이 맞춥니다.

| | 공유 여부 | 왜 |
|---|---|---|
| `OPERATOR_PRIVATE_KEY` | **팀 공용** | 배포·admin 권한이 이 키에 붙습니다 |
| `MASTER_MNEMONIC` | **개인** | 유저 지갑 파생용. 각자 DB도 다르므로 맞출 이유가 없습니다 |

`npm install` 이 만든 `.env` 에는 일단 **개인 키**가 들어 있습니다.
체인 조회와 지갑 파생은 그대로 되지만, 팀이 배포한 컨트랙트를 건드리려면
**팀 공용 키를 받아서 `OPERATOR_PRIVATE_KEY` 를 바꿔야 합니다.** git 밖으로 전달하세요.

키가 안 맞으면 `/health` 가 알려줍니다.

```
배포한 계정과 오퍼레이터가 다릅니다 — 배포 0xabc…, 지금 0xdef…
onlyOwner 함수가 막힙니다. 같은 키를 쓰거나 직접 다시 배포하세요.
```

> 공용 키는 로컬 노드의 니모닉 계정에 없어서 로컬 체인에서는 잔고가 0 입니다.
> `npm run chain:reset` 이 알아서 채워주니 신경 쓰지 않아도 됩니다.

빠르게 반복해야 할 때는 로컬 체인(`npm run chain`)도 그대로 쓸 수 있습니다.
로컬 체인도 같은 하드포크(`constantinople`)로 맞춰뒀습니다.

---

## 4. 폴더 — 뭐가 어디에 있나

```
blockchain/
├─ .env.example        환경변수 설명서 (값 없음, 커밋됨)
├─ .env                실제 값 (커밋 안 됨, 자동 생성)
├─ DESIGN.md           설계와 규칙. 작업 전에 읽는 문서
├─ README.md           이 파일
│
├─ contracts/          블록체인 위에 올라가는 코드
└─ api/                블록체인에 말을 거는 서버
```

### contracts/ — 체인 위에서 도는 코드

Hardhat 이라는 도구를 씁니다. Solidity 컴파일·테스트·배포를 다 해주는 프레임워크입니다.

```
contracts/
├─ contracts/          .sol 파일. 실제로 체인에 올라가는 코드
│                      CatMoney.sol (캣머니). M1 에서 TicketSBT.sol 이 들어옵니다
├─ test/               컨트랙트 테스트. 컨트랙트 테스트는 여기에만 씁니다
├─ scripts/
│   ├─ deploy.ts       배포 스크립트. 배포하고 주소를 파일로 남깁니다
│   └─ setupEnv.ts     .env 를 만들어주는 스크립트 (npm install 이 부름)
├─ lib/
│   └─ deployments.ts  배포 주소를 읽고 쓰는 헬퍼
├─ deployments/        배포 결과가 여기 쌓입니다 (localhost.json 등)
├─ hardhat.config.ts   솔리디티 버전 · 네트워크 설정
└─ index.ts            api 가 가져다 쓰는 공개 창구
```

자동으로 생기는 폴더 세 개는 **건드리지 않습니다** (git 에도 안 올라갑니다).

| | 무엇 |
|---|---|
| `artifacts/` | 컴파일 결과 (ABI, 바이트코드) |
| `cache/` | Hardhat 캐시 |
| `typechain-types/` | ABI 에서 자동 생성된 TypeScript 타입 |

**컨트랙트 주소를 코드에 적지 마세요.** 체인을 껐다 켜면 주소가 바뀌고,
팀원마다 값도 다릅니다. `deployments/` 에 저장된 걸 읽어 씁니다.

### api/ — 체인에 말을 거는 서버

Express 서버입니다. 요청이 들어오면 **층을 따라 아래로 내려갑니다.**

```
api/src/
├─ main.ts             서버를 켭니다. 포트 열기, 종료 처리
├─ app.ts              Express 조립 (미들웨어 순서)
│
├─ routes/             "어떤 주소로 오면 누가 처리하나" 만 적습니다
├─ controllers/        요청을 검사하고, 응답 모양을 만듭니다
├─ services/           실제로 하는 일. 여기가 작업의 중심입니다
├─ chain/              체인과 대화하는 곳. ethers 는 여기서만 씁니다
│   ├─ provider.ts     체인 연결 · 오퍼레이터 지갑
│   └─ keys/           니모닉에서 유저 지갑을 파생
│
├─ config/             환경변수 검증. process.env 는 여기서만 읽습니다
├─ docs/               OpenAPI 문서 (Swagger UI). 구현된 것만 적습니다
├─ middlewares/        인증 · 에러 처리 · 로깅
└─ shared/             에러 타입 · 로거 · 공통 유틸
```

**요청 하나가 흐르는 순서**를 따라가 보면 구조가 한눈에 보입니다.

```
POST /internal/wallets  { "derivationIndex": 42 }
        │
        ▼
  middlewares/internalAuth      x-internal-key 헤더가 맞나
        │
        ▼
  routes/index.ts               이 주소는 walletController 담당
        │
        ▼
  controllers/wallet.controller  derivationIndex 가 숫자 맞나 검사
        │
        ▼
  services/wallet.service        "지갑 주소를 구한다"
        │                        - ethers 를 모릅니다
        ▼
  chain/keys/hdWallet            니모닉 + 42 → 주소 계산
        │
        ▼
  { "address": "0x…", "path": "m/44'/60'/1'/0/42" }
```

각 층이 아는 것이 다릅니다.

| 층 | 아는 것 | 모르는 것 |
|---|---|---|
| `controllers/` | HTTP (상태코드, 헤더, JSON) | 체인 |
| `services/` | 업무 규칙 ("티켓을 발행한다") | HTTP도 체인도 |
| `chain/` | 체인 (ethers, 서명, 가스) | HTTP |

**`chain/` 밖에서 `ethers` 를 import 하지 마세요.** 이 한 줄이 층을 지킵니다.
([DESIGN.md 4-1](DESIGN.md#4-1-chain-밖에서-ethers-를-import-하지-않는다))

### 기능을 하나 추가한다면

예를 들어 "티켓 발행" 을 만든다면 순서는 이렇습니다.

1. `contracts/contracts/TicketSBT.sol` — 컨트랙트를 씁니다
2. `contracts/test/TicketSBT.spec.ts` — 테스트를 씁니다 (`npm run test`)
3. `contracts/scripts/deploy.ts` — 배포 목록에 한 줄 추가
4. `api/src/services/ticket.service.ts` — "티켓을 발행한다" 유스케이스
5. `api/src/controllers/` + `routes/` — HTTP 로 열어줍니다

**1~3번을 먼저 끝내고 4~5번으로 갑니다.** 컨트랙트가 확정되지 않으면 서버 코드를 다시 씁니다.

---

## 5. 명령어

`blockchain/` 루트에서 실행합니다.

| 명령어 | 설명 |
|---|---|
| `npm run setup:env` | `.env` 생성 (키를 무작위로). `npm install` 이 자동으로 부릅니다 |
| `npm run dev` | API 서버 (파일 저장 시 자동 재시작) |
| `npm run deploy:ssafy` | **SSAFY 체인에 배포** + `deployments/ssafy.json` 갱신 |
| `npm run compile` | 컨트랙트 컴파일 + 타입 생성 |
| `npm run test` | 컨트랙트 테스트 (메모리 체인) |
| `npm run typecheck` | 두 폴더 타입 검사 |

평소엔 이 정도면 됩니다. 아래는 로컬 체인을 쓸 때만 필요합니다.

| 명령어 | 설명 |
|---|---|
| `npm run chain` | 로컬 체인 실행 (127.0.0.1:8545) |
| `npm run chain:slow` | 10초마다 블록 생성 — SSAFY 체인과 같은 속도 ([8장](DESIGN.md#8-체인-운영)) |
| `npm run chain:reset` | 로컬 체인에 재배포 + `deployments/localhost.json` 갱신 |

`npm run deploy:ssafy` 로 배포한 것은 **남습니다.** 공용 체인이라 되돌릴 수 없으니,
컨트랙트가 확정되기 전에는 로컬 체인이나 `npm run test` 로 먼저 돌려보세요.

`npm run chain:slow` 는 로컬 체인을 SSAFY 체인만큼 느리게 만듭니다.
로컬은 즉시 확정돼서 "보내고 바로 읽기" 같은 코드가 통과해버리는데,
SSAFY 체인에서는 10초쯤 걸려 무너집니다. 통합 테스트할 때 켜서 미리 잡습니다.

---

## 6. 지금 어디까지 됐나

| | 상태 |
|---|---|
| **M0** 뼈대 · SSAFY 체인 연결 · `/health` | 완료 |
| **M1** `TicketSBT` + 릴레이어 + 발행/사용/취소 | |
| **M2** 대사·복구 (드롭된 tx 재전송, 가스 상향) | |
| **M3** `CatMoney`(캣머니) | 컨트랙트·테스트·가입 시드 발행 완료. SSAFY 체인 배포는 아직 |
| | (캣머니는 발행/소각으로만 움직입니다 — 트레저리 없음. [DESIGN.md 6장](DESIGN.md#6-컨트랙트-설계)) |
| **M4** ERC-4337 | **이 체인에서는 불가** (아래) |

> **표준 EntryPoint 를 SSAFY 체인에 올릴 수 없습니다.** EntryPoint 는 `block.chainid`
> 와 `block.basefee` 를 쓰는데, 이 체인의 EVM(Constantinople)에는 두 옵코드가 다
> 없습니다. 컴파일 단계에서 막힙니다. 포크해서 상수로 박으면 컴파일은 되지만
> 표준 주소·감사·번들러를 전부 잃습니다. 자세한 건 [DESIGN.md 9장](DESIGN.md#9-구현-순서).

전체 계획은 [DESIGN.md 9장](DESIGN.md#9-구현-순서)에 있습니다.

### 지금 열려 있는 API

```bash
GET  /health                      인증 없음. 체인 연결·오퍼레이터 잔고·배포 상태
POST /internal/wallets            { "derivationIndex": 7, "seedAmount": "1500" }
                                  → 주소 + 가입 시드 발행 (202 + txHash)

GET  /docs                        Swagger UI (운영 제외)
GET  /docs.json                   OpenAPI 원본
```

Swagger 에는 **아직 안 만든 것도 계약만 먼저** 올려뒀습니다. Spring 이 병렬로
붙일 수 있게 하기 위해서입니다. `(예정)` 태그와 `[미구현]` 표시가 붙어 있고,
**호출하면 404 가 납니다.**

| 태그 | | |
|---|---|---|
| 캣머니 (예정) | `balance` · `mint` · `burn` | M3 |
| 티켓 (예정) | `issue` · 조회 · `by-key` · `use` · `void` | M1~M2 |
| 트랜잭션 (예정) | `tx/{txHash}` | M1 |

구현하면 `api/src/docs/planned.ts` 에서 지우고 `openapi.ts` 로 옮깁니다.
거기서는 컨트롤러의 zod 스키마를 그대로 쓰고 응답도 타입과 대조합니다.

`/internal/**` 는 `x-internal-key` 헤더가 필요합니다. 값은 `.env` 의 `INTERNAL_API_KEY` 입니다.

**컨트랙트는 아직 하나도 없습니다.** 티켓 발행 같은 도메인 기능은 M1에서 붙습니다.

---

## 7. 자주 막히는 곳

| 증상 | 원인 |
|---|---|
| `/health` 의 `connected: false` | 네트워크 문제이거나 `.env` 의 `RPC_URL` 이 틀림 |
| `chainId 불일치` 경고 | `.env` 의 `CHAIN_ID` 가 `31221` 이 아님 |
| 모든 요청이 `network changed` 로 실패 | 위와 같은 원인. `/health` 가 어느 쪽이 틀렸는지 알려줍니다 |
| `401 UNAUTHORIZED` | `x-internal-key` 헤더가 없거나 `.env` 값과 다름 |
| `환경변수 오류` 로 즉시 종료 | `.env` 가 없음 → `npm run setup:env`. 있으면 그 값이 형식에 안 맞는 것 |
| 배포가 `invalid opcode` 로 실패 | `evmVersion` 이 올라갔음 → `constantinople` 이어야 합니다 (3장) |
| `onlyOwner` 인데 내가 배포함 | `OPERATOR_PRIVATE_KEY` 가 팀 공용 키인지 확인 (3장) |
| `mcopy` 컴파일 에러 | OpenZeppelin 이 5.1.0 위로 올라갔음 (3장) |
| `onlyOwner` 함수가 막힘 | 남이 배포한 컨트랙트임. `/health` 의 배포 계정 경고 확인 |
| `오퍼레이터 잔고가 0` 경고 | SSAFY 체인에서는 **안 뜹니다.** 뜬다면 로컬 체인에 붙어 있는 것 |

주의: **`.env` 를 커밋하지 마세요.** 니모닉이 git 히스토리에 영구히 남습니다.
설명이 필요하면 값이 없는 `.env.example` 에 적으세요.
