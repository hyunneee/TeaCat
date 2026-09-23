-- 시뮬레이터가 만든 거래의 정답표 (AUCTION_FRAUD_DESIGN.md 14-2).
--
-- 🔴 관리자 판정(nft_trade_reviews.decision)과 절대 섞지 않는다.
--    관리자 판정은 "사람이 실거래를 보고 내린 라벨" 이고, 여기는 "우리가 대본을 알고 만든 라벨" 이다.
--    한 컬럼에 섞으면 "실데이터 기준 정밀도" 라는 말을 더 이상 할 수 없다.
--    합성은 학습용, 실데이터는 평가용 — 발표에서도 이 구분을 숨기지 않는다.
--
-- 🔴 로컬·개발 DB 전용이다. 여기 행이 달린 거래는 COMPLETED 로 들어가므로
--    시세 중앙값·거래량·인기 포토카드 순위를 그대로 오염시킨다. 운영에서 돌리지 않는다.
--    batch_id 가 있어 한 번에 되돌릴 수 있다 (되돌리는 순서는 아래 주석).
--
-- 되돌리기:
--   DELETE FROM nft_trade_risk_features WHERE trade_id IN (SELECT trade_id FROM simulation_labels WHERE batch_id = :b);
--   DELETE FROM nft_trade_reviews       WHERE trade_id IN (SELECT trade_id FROM simulation_labels WHERE batch_id = :b);
--   DELETE FROM simulation_labels       WHERE batch_id = :b;
--   -- 거래·경매·입찰·카드·회원은 sim- 접두사로 남으므로 필요하면 따로 정리한다

CREATE TABLE simulation_labels
(
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trade_id       bigint      NOT NULL,
    batch_id       uuid        NOT NULL,
    -- 대본 이름. ENUM 으로 두지 않는다 — 대본은 실험마다 늘어나는데 그때마다 마이그레이션을 쓸 이유가 없다
    scenario       varchar(40) NOT NULL,
    -- 이 거래가 사기 대본의 일부인가. 정상 표본은 false
    fraud          boolean     NOT NULL,
    -- 대본이 노린 규칙 코드. 규칙이 실제로 잡았는지는 nft_trade_risk_features.signals 와 비교해서 센다.
    -- 비어 있는데 fraud=true 면 "규칙으로는 못 잡는 사기" 를 일부러 넣은 것이다 (3단 순환 거래)
    expected_rules jsonb       NOT NULL DEFAULT '[]'::jsonb,
    note           varchar(200),
    created_at     timestamp   NOT NULL DEFAULT now(),

    CONSTRAINT fk_simulation_labels_trade FOREIGN KEY (trade_id) REFERENCES nft_photocard_trades (id),
    CONSTRAINT uq_simulation_labels_trade UNIQUE (trade_id)
);

CREATE INDEX idx_simulation_labels_batch ON simulation_labels (batch_id);
