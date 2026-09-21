-- 이상거래 심사 행 (AUCTION_FRAUD_DESIGN.md 6-2).
-- 거래 하나에 심사 행은 최대 하나다. 거래 행이 무엇을·누가·얼마에·어떤 홀드로 사는지 전부 들고 있으므로
-- 심사 행은 거래 id 와 "왜 걸렸나(signals)", "AI 가 무엇이라 했나(analysis)", "사람이 어떻게 정했나(decision)" 만 갖는다.

CREATE TYPE nft_review_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE nft_review_analysis_status AS ENUM ('PENDING', 'DONE', 'FAILED', 'SKIPPED');
CREATE TYPE nft_review_decision AS ENUM ('APPROVED', 'REJECTED');

CREATE TABLE nft_trade_reviews
(
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trade_id          bigint                     NOT NULL,
    -- [{rule, severity, evidence:{...}}]
    signals           jsonb                      NOT NULL,
    max_severity      nft_review_severity        NOT NULL,
    analysis_status   nft_review_analysis_status NOT NULL DEFAULT 'PENDING',
    -- AI 분석 보고서. 7-3 의 출력 스키마 그대로. 분석 전이거나 실패하면 NULL
    analysis          jsonb,
    analysis_model    varchar(64),
    analysis_attempts int                        NOT NULL DEFAULT 0,
    decision          nft_review_decision,
    -- NULL 이면 시한 경과 자동 승인
    decided_by        bigint,
    decision_note     text,
    created_at        timestamp                  NOT NULL DEFAULT now(),
    decided_at        timestamp,

    CONSTRAINT fk_nft_trade_reviews_trade FOREIGN KEY (trade_id) REFERENCES nft_photocard_trades (id),
    CONSTRAINT fk_nft_trade_reviews_decided_by FOREIGN KEY (decided_by) REFERENCES users (id),
    CONSTRAINT uq_nft_trade_reviews_trade UNIQUE (trade_id),
    CONSTRAINT chk_nft_trade_reviews_decided CHECK ((decision IS NULL) = (decided_at IS NULL)),
    CONSTRAINT chk_nft_trade_reviews_attempts CHECK (analysis_attempts >= 0)
);

-- 관리자 큐: 아직 결정 안 난 것만 오래된 순으로
CREATE INDEX idx_nft_trade_reviews_open
    ON nft_trade_reviews (created_at)
    WHERE decision IS NULL;

-- AI 분석 스위퍼: 아직 분석 안 붙은 것
CREATE INDEX idx_nft_trade_reviews_analysis_pending
    ON nft_trade_reviews (id)
    WHERE analysis_status = 'PENDING';
