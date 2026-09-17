-- 기존 거래는 이미 DB 소유권 이전까지 끝난 데이터이므로 COMPLETED 로 보존한다.

CREATE TYPE nft_trade_chain_status AS ENUM (
    'PENDING', 'CAT_SUBMITTED', 'CAT_CONFIRMED', 'NFT_SUBMITTED', 'COMPLETED',
    'COMPENSATING', 'REFUND_SUBMITTED', 'COMPENSATED', 'FAILED', 'MANUAL_REVIEW'
);
ALTER TABLE nft_photocard_trades
    ADD COLUMN chain_status nft_trade_chain_status NOT NULL DEFAULT 'COMPLETED',
    ADD COLUMN payment_hold_ref_type cat_money_hold_ref_type,
    ADD COLUMN payment_hold_ref_id bigint,
    ADD COLUMN settle_operation_key varchar(200),
    ADD COLUMN settle_tx_hash char(66),
    ADD COLUMN transfer_operation_key varchar(200),
    ADD COLUMN transfer_tx_hash char(66),
    ADD COLUMN refund_operation_key varchar(200),
    ADD COLUMN refund_tx_hash char(66),
    ADD COLUMN failure_code varchar(100),
    ADD COLUMN retry_count int NOT NULL DEFAULT 0,
    ADD COLUMN next_retry_at timestamp,
    ADD COLUMN completed_at timestamp,
    ADD COLUMN created_at timestamp NOT NULL DEFAULT now(),
    ADD COLUMN updated_at timestamp NOT NULL DEFAULT now();

UPDATE nft_photocard_trades SET completed_at = traded_at, created_at = traded_at;

ALTER TABLE nft_photocard_trades
    ALTER COLUMN traded_at DROP NOT NULL,
    ALTER COLUMN traded_at DROP DEFAULT,
    ADD CONSTRAINT chk_nft_trade_retry_count CHECK (retry_count >= 0);

ALTER TABLE nft_photocard_listings
    DROP CONSTRAINT chk_nft_photocard_listings_closed_at,
    ADD CONSTRAINT chk_nft_photocard_listings_closed_at CHECK (
        (status IN ('ACTIVE', 'SETTLING') AND closed_at IS NULL)
        OR (status IN ('SOLD', 'CANCELLED') AND closed_at IS NOT NULL));

ALTER TABLE nft_auctions
    DROP CONSTRAINT chk_nft_auctions_closed,
    DROP CONSTRAINT chk_nft_auctions_winner,
    ADD CONSTRAINT chk_nft_auctions_closed CHECK (
        (status = 'ACTIVE' AND closed_at IS NULL) OR (status <> 'ACTIVE' AND closed_at IS NOT NULL)),
    ADD CONSTRAINT chk_nft_auctions_winner CHECK (
        (status IN ('SOLD', 'SETTLING')) = (winner_id IS NOT NULL));

CREATE INDEX idx_nft_trade_settlement_work
    ON nft_photocard_trades (chain_status, next_retry_at, id)
    WHERE chain_status NOT IN ('COMPLETED', 'COMPENSATED', 'FAILED', 'MANUAL_REVIEW');

DROP INDEX uq_nft_photocard_listings_active;
CREATE UNIQUE INDEX uq_nft_photocard_listings_active
    ON nft_photocard_listings (photocard_id) WHERE status IN ('ACTIVE', 'SETTLING');

DROP INDEX uq_nft_auctions_active;
CREATE UNIQUE INDEX uq_nft_auctions_active
    ON nft_auctions (photocard_id) WHERE status IN ('ACTIVE', 'SETTLING');
