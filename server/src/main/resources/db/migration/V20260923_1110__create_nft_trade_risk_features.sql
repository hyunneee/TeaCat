-- 이상거래 학습용 피처 스냅샷 (AUCTION_FRAUD_DESIGN.md 14-2).
--
-- 🔴 심사 행(nft_trade_reviews)과 역할이 다르다.
--    심사 행은 "규칙에 걸린 것" 만 생기고 사람이 읽는다. 여기는 "모든 거래" 가 한 줄씩 생기고 기계가 읽는다.
--    통과한 거래를 안 남기면 모델이 정상이 무엇인지 배울 수 없다 — 지금까지 통과한 거래는 이미 복구할 수 없다.
--
-- 🔴 시점의 값을 고정해 둔다. 나중에 다시 조회하면 그 사이 거래가 더 쌓여 과거 시점을 재현할 수 없다.
--
-- 개인정보는 넣지 않는다. IP·UA·전화번호 원문 대신 "같음/다름" 불리언만 담는다 (규칙 신호와 같은 원칙).
-- 라벨은 여기 복사하지 않고 review_id 로 심사 행의 decision 을 조인해서 읽는다. 사람이 판정을 바꾸면 한 곳만 바뀐다.

CREATE TABLE nft_trade_risk_features
(
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trade_id     bigint    NOT NULL,
    -- 규칙이 본 수치를 그대로 벡터로. 파생값(배율·경과 분)도 미리 계산해 담는다 —
    -- 학습 때 다시 계산하면 서빙과 어긋난다(training-serving skew)
    features     jsonb     NOT NULL,
    -- 규칙 결과. 신호가 없으면 빈 배열
    signals      jsonb     NOT NULL,
    max_severity nft_review_severity,
    flagged      boolean   NOT NULL,
    -- 심사 행이 생겼으면 그 id. 통과한 거래는 NULL 이고 "약한 정상 라벨" 로 쓴다
    review_id    bigint,
    screened_at  timestamp NOT NULL DEFAULT now(),

    CONSTRAINT fk_nft_trade_risk_features_trade FOREIGN KEY (trade_id) REFERENCES nft_photocard_trades (id),
    CONSTRAINT fk_nft_trade_risk_features_review FOREIGN KEY (review_id) REFERENCES nft_trade_reviews (id),
    CONSTRAINT uq_nft_trade_risk_features_trade UNIQUE (trade_id)
);

-- 학습 데이터 추출: 기간으로 자르고 라벨(심사)을 조인한다
CREATE INDEX idx_nft_trade_risk_features_screened_at
    ON nft_trade_risk_features (screened_at);

CREATE INDEX idx_nft_trade_risk_features_review
    ON nft_trade_risk_features (review_id)
    WHERE review_id IS NOT NULL;
