-- 이상거래 심사를 "보류" 에서 "표시" 로 (AUCTION_FRAUD_DESIGN.md 2장 mode).
-- 규칙에 걸려도 정산은 그대로 흘려보내고 심사 행만 남긴다. 지금 단계의 목적은 차단이 아니라 데이터 수집이다.
--   flagged : 보류 기준(HIGH 1개 또는 MEDIUM 2개)을 넘었나. 신호가 하나라도 있으면 행이 생기므로 따로 둔다
--   held    : 실제로 정산을 멈췄나(HOLD 모드). 관리자 결정이 돈을 움직일지(승인·거절) 기록만 할지(정상·부정)를 가른다
ALTER TABLE nft_trade_reviews
    ADD COLUMN flagged boolean NOT NULL DEFAULT true,
    ADD COLUMN held    boolean NOT NULL DEFAULT false;

-- 기존 행은 전부 보류 모드에서 만들어졌다. 아직 RISK_REVIEW 이거나 승인·거절로 끝난 것 모두 held 다
UPDATE nft_trade_reviews SET held = true;

CREATE INDEX idx_nft_trade_reviews_held_open
    ON nft_trade_reviews (created_at)
    WHERE decision IS NULL AND held;
