-- 섀도우 모델 점수 (AUCTION_FRAUD_DESIGN.md 14-3).
--
-- 🔴 이 점수를 읽고 분기하는 코드는 하나도 없다. 저장만 한다.
--    모델이 틀려도 사용자에게 아무 일도 일어나지 않는 상태로 한동안 돌린 뒤,
--    관리자 판정과 나란히 놓고 일치율을 본 다음에야 권한을 준다 (14-4 승격 게이트).
--
-- 🔴 라벨을 여기 복사하지 않는 것과 같은 이유로, 점수도 피처 행에 붙여 둔다 —
--    "그 시점의 피처로 그 시점의 모델이 낸 점수" 가 한 행에 같이 있어야 나중에 재현이 된다.
--
-- model_version 이 있어야 모델을 바꾼 뒤에도 이전 점수와 섞이지 않는다.
-- 점수가 NULL 인 행은 모델이 없었거나 채점이 실패한 것이다 — 채점 실패는 정산을 막지 않는다.

ALTER TABLE nft_trade_risk_features
    ADD COLUMN model_score   double precision,
    ADD COLUMN model_version varchar(40);

ALTER TABLE nft_trade_risk_features
    ADD CONSTRAINT chk_nft_trade_risk_features_model_score
        CHECK (model_score IS NULL OR (model_score >= 0 AND model_score <= 1));

-- 점수 분포를 보거나 상위 N 건을 뽑을 때. 점수가 없는 행은 인덱스에 넣지 않는다
CREATE INDEX idx_nft_trade_risk_features_model_score
    ON nft_trade_risk_features (model_version, model_score DESC)
    WHERE model_score IS NOT NULL;
