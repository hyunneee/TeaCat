# 이상거래 탐지 흐름 (2026-09-24 기준)

`server/AUCTION_FRAUD_DESIGN.md` 의 구조를 코드 기준으로 다시 그린 것.

---

## 1. 큰 그림 — 심사가 어디에 끼어 있나

핵심은 **심사가 체인 전송 "직전"에 끼어 있다**는 것이다. 사용자가 입찰하거나 구매하는
순간에는 아무 판단도 하지 않는다 — 그 시점에는 아직 거래가 성립하지 않았고,
마감 직전에 몰리는 요청을 느리게 만들 이유도 없다.

```mermaid
sequenceDiagram
    autonumber
    actor U as 사용자
    participant API as 경매·마켓 API
    participant CL as 마감 스위퍼
    participant SCH as 정산 스케줄러
    participant P as 정산 프로세서
    participant W as 정산 Writer
    participant CH as 블록체인
    actor AD as 관리자

    U->>API: 입찰 / 즉시구매 / 고정가 구매
    API->>API: ClientRequest 로 IP·UA해시 기록
    Note right of API: 여기서는 심사하지 않는다

    CL->>W: 마감 → 거래 생성 (PENDING)

    loop 정산 주기
        SCH->>P: process(tradeId)
    end

    P->>W: screen(tradeId)
    Note over W: 규칙 R1~R8 + 섀도우 모델 점수

    alt FLAG 모드 (현재 운영)
        W-->>P: false
        P->>CH: CAT 전송 → NFT 전송 → 영수증 확인
        Note over W: 심사 행·피처 행은 남는다.<br/>거래는 멈추지 않는다
    else HOLD 모드 (아직 안 켬)
        W-->>P: true
        W->>W: chain_status = RISK_REVIEW
        Note over CH: 체인으로 나가지 않는다
        AD->>W: 승인 → PENDING 복귀 / 거절 → 보상
    end

    AD->>AD: /admin/trade-reviews 에서 심사·거래 내역 확인
```

### 왜 이 자리인가

| 후보 자리 | 문제 |
| --- | --- |
| 입찰·구매 요청 시점 | 아직 거래가 아니다. 마감 직전 요청이 몰리는데 느려진다 |
| 마감(거래 생성) 시점 | 마감 스위퍼가 한 번에 여러 건을 닫는다. 한 건이 느리면 전부 밀린다 |
| **체인 전송 직전** ✅ | 이미 비동기이고, 돈이 실제로 움직이기 전 마지막 지점이다 |

---

## 2. 자세히 — `screen()` 안에서 일어나는 일

```mermaid
sequenceDiagram
    autonumber
    participant P as 정산 프로세서
    participant W as NftTradeSettlementWriter
    participant SC as NftTradeRiskScreener
    participant Q as NftTradeRiskQueryRepository
    participant R as 규칙 R1~R8
    participant FV as TradeRiskFeatureVector
    participant M as TradeRiskModelScorer
    participant DB as PostgreSQL

    P->>W: screen(tradeId)
    W->>DB: SELECT ... FOR UPDATE
    Note over W: PENDING 이 아니거나<br/>이미 심사했으면 바로 종료

    W->>SC: screen(tradeId)
    SC->>Q: loadContext(tradeId)

    Note over Q,DB: 쿼리 16개를 한 번에 모아<br/>맥락 객체 하나를 만든다
    Q->>DB: 거래·당사자·단말·도안
    Q->>DB: 입찰 이력 (최고·최초·2위)
    Q->>DB: 거래쌍 반복·카드 순환
    Q->>DB: 같은 도안 시세 중앙값
    Q->>DB: 거래량 (최근 7일 vs 기준 4주)
    Q->>DB: 매집 지분 (보유량 / 발행량)
    Q->>DB: 첫 충전 시각
    Q->>DB: 로그인 단말 이력
    Q->>DB: 그래프 — 재귀 CTE 3홉
    Q->>DB: 꾸밈 이력 (꾸민 뒤 경과·꾸민 사람)
    Q->>DB: 속도 (10분·1시간·24시간 창)
    Q-->>SC: TradeRiskContext

    loop 규칙 8개 (코드 순서 고정)
        SC->>R: evaluate(context, properties)
        R-->>SC: 신호 0..n
    end

    SC->>FV: of(context)
    FV-->>SC: 피처 44개 (금액 절대값 없음)
    SC->>M: score(features)
    M-->>SC: 0.0~1.0 또는 null
    Note over M: 학습 범위로 자르고 채점.<br/>범위 밖이 많으면 판단 불가(null).<br/>어떤 경우에도 정산을 막지 않는다
    SC-->>W: TradeRiskAssessment

    alt 신호가 하나라도 있음
        W->>DB: nft_trade_reviews INSERT
    end
    W->>DB: nft_trade_risk_features INSERT
    Note over W,DB: 🔴 통과한 거래도 반드시 남긴다.<br/>정상 사례가 없으면 모델이 정상을 못 배운다

    alt flagged AND HOLD 모드
        W->>DB: chain_status = RISK_REVIEW
        W-->>P: true (정산 중단)
    else
        W->>DB: risk_screened_at = now()
        W-->>P: false (체인 전송으로)
    end
```

---

## 3. 읽을 때 헷갈리기 쉬운 지점

### 맥락 객체를 한 번만 만든다

규칙 8개가 각자 조회하지 않는다. `loadContext` 가 쿼리 16개로 `TradeRiskContext` 하나를
만들고, 규칙은 **그 값만 읽는 순수 함수**에 가깝다.

그래야 (1) 규칙끼리 본 값이 어긋나지 않고, (2) 같은 맥락으로 피처를 만들 수 있다.
학습용 조회를 따로 짜면 서빙 때 값과 미묘하게 달라진다(training-serving skew).

### 신호가 있다고 다 멈추는 게 아니다

```
HIGH 1개 이상  → flagged
MEDIUM 2개 이상 → flagged
MEDIUM 1개     → 기록만 남고 flagged 아님
```

정상 거래도 규칙 하나에는 흔히 걸린다. 그리고 **지금은 FLAG 모드라 flagged 여도 멈추지
않는다** — 표시만 하고 관리자 화면에 쌓는다. 차단은 오탐률을 보고 나서 켠다.

### 모델 점수는 아무것도 결정하지 않는다

`model_score` 를 읽고 분기하는 코드는 하나도 없다. 저장만 된다.
관리자 판정과 나란히 놓고 일치율을 본 다음에야 단계적으로 권한을 준다.

### 심사 행과 피처 행은 역할이 다르다

| | `nft_trade_reviews` | `nft_trade_risk_features` |
| --- | --- | --- |
| 언제 생기나 | 규칙에 **걸렸을 때만** | **모든 거래** |
| 누가 읽나 | 사람 (관리자 콘솔) | 기계 (학습 스크립트) |
| 담는 것 | 규칙 근거·관리자 판정 | 피처 44개 + 모델 점수 |

---

## 4. 관련 파일

```
nft/service/
  ├─ NftTradeSettlementScheduler.java   주기적으로 미완료 거래를 훑는다
  ├─ NftTradeSettlementProcessor.java   체인 단계 진행 (트랜잭션 안 엶)
  ├─ NftTradeSettlementWriter.java      screen() — 짧은 DB 트랜잭션
  ├─ NftTradeRiskScreener.java          규칙 실행 + 피처 + 모델 점수
  ├─ TradeRiskRule.java                 규칙 인터페이스 (구현 8개)
  ├─ TradeRiskContext.java              맥락 객체 (Graph · Decoration · Velocity)
  ├─ TradeRiskFeatureVector.java        피처 정의 — 여기 하나뿐
  └─ TradeRiskModelScorer.java          로지스틱 회귀 채점 (자르기·범위 밖 중단)
nft/repository/
  └─ NftTradeRiskQueryRepository.java   loadContext — 쿼리 16개
```
