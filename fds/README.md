# fds — 이상거래 섀도우 모델

NFT 거래 이상거래 탐지에 붙이는 학습 모델. 설계는 [`server/AUCTION_FRAUD_DESIGN.md`](../server/AUCTION_FRAUD_DESIGN.md) 14장.

## 이게 무엇이고 무엇이 아닌가

**학습만** 여기서 한다. **채점은 자바가 한다** — `server/.../TradeRiskModelScorer`.

로지스틱 회귀의 채점은 내적 한 번이라 파이썬 서비스를 띄울 이유가 없다. 사이드카를 두면 정산 경로가
다른 프로세스의 생사에 매이고, 그 프로세스가 죽었을 때의 행동을 또 설계해야 한다.
모델이 복잡해져 이 방식으로 안 될 때 사이드카로 옮기면 된다.

```
서버(심사) ──피처 저장──▶ nft_trade_risk_features
                                  │
                        train.py  │ 읽어서 학습
                                  ▼
                            model.json (계수)
                                  │
              서버가 기동 때 읽어 채점 ◀─┘
```

## 🔴 지금 라벨은 우리가 짠 대본이다

`simulation_labels.fraud` — 시뮬레이터가 만든 합성 데이터다. 실사용자 판정이 아니다.

- 합성은 **학습용**, 실데이터는 **평가용**이다. 섞지 않는다.
- 이 모델의 성능을 "실데이터 기준 정밀도" 라고 말하면 안 된다.
- 관리자 판정(`nft_trade_reviews.decision`)이 쌓이면 그걸로 다시 재야 한다.

## 🔴 규칙 결과를 피처로 넣지 않는다

`flagged` · `maxSeverity` · `signals` 는 학습에서 제외한다(`EXCLUDED`).
넣으면 모델이 규칙을 베끼고 끝나서 "모델이 규칙보다 나은가" 라는 질문 자체가 성립하지 않는다.

## 쓰는 법

### 1. 데이터 만들기

서버를 시뮬레이터 켜고 띄운 뒤, 관리자 API 로 **씨앗을 달리해 여러 판** 돌린다.
판이 하나뿐이면 같은 시장·같은 계정이 학습과 검증 양쪽에 섞여 성능이 부풀려진다.

```bash
cd server && NFT_TRADE_SIMULATOR_ENABLED=true ./gradlew bootRun
```

`POST /admin/nft/trade-reviews/simulate` (Swagger: `http://localhost:8080/api/swagger-ui.html`)

```json
{"designs":6,"historyPerDesign":20,"normalTrades":300,"shillCases":20,"circularCases":16,"hoardingCases":12,"takeoverCases":20,"seed":101}
```

### 2. 학습

```bash
pip install -r fds/requirements.txt
python fds/train.py --out server/src/main/resources/fds/model.json
```

배치가 2개 이상이면 **마지막 판을 통째로 남겨** 검증한다. 하나뿐이면 5겹 교차검증으로 떨어지고,
그때는 출력에 경고가 찍힌다.

### 3. 반영

`model.json` 은 서버 리소스라 **재기동해야** 적용된다. 기동 로그에서 확인한다.

```
이상거래 섀도우 모델 적재 version=lr-20260923-0512 피처=38개
```

파일이 없으면 경고만 남기고 점수 없이 돈다 — 모델을 아직 학습하지 않은 상태가 정상적인 단계다.

### 4. 확인

```sql
SELECT l.scenario, count(*), round(avg(f.model_score)::numeric, 3) AS 평균점수
  FROM simulation_labels l JOIN nft_trade_risk_features f ON f.trade_id = l.trade_id
 WHERE f.model_score IS NOT NULL
 GROUP BY 1 ORDER BY 3 DESC;
```

## 무엇을 보고 판단하나

**PR-AUC 를 본다.** 정확도(accuracy)는 보지 않는다 — 부정 거래가 드물어서, 전부 정상이라고
찍기만 해도 정확도가 높게 나온다. ROC-AUC 도 불균형에서는 후하게 나온다.

지금 단계의 목표는 "규칙이 놓친 것을 모델이 집어내는가" 다. 특히 **3단 순환**(`CIRCULAR_RING`) —
규칙으로는 원리적으로 못 잡고, 그래프 피처를 넣어야 비로소 보인다(설계문서 14-2-2).
대본별 평균 점수 출력에서 `CIRCULAR_RING` 이 `NORMAL` 보다 확실히 높은지 본다.

## 이 모델은 아무 결정도 하지 않는다

점수는 `nft_trade_risk_features.model_score` 에 **저장만** 된다. 읽고 분기하는 코드는 없다.
권한은 단계적으로 준다 — 설계문서 14-4 승격 게이트.
