-- ================================
-- NFT 포토카드 마켓
-- ================================
-- 블록체인과 CAT 원장은 후속 도메인에서 연결한다. 현재는 DB 소유권과 거래 이력을
-- 원자적으로 관리할 수 있는 거래 기반만 만든다.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE nft_photocard_listing_status AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');

CREATE TABLE nft_photocard_designs
(
    id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    performance_general_id bigint       NOT NULL,
    name                   varchar(100) NOT NULL,
    image_url              text         NOT NULL,
    total_supply           int          NOT NULL,
    issued_supply          int          NOT NULL DEFAULT 0,
    created_at             timestamp    NOT NULL DEFAULT now(),
    updated_at             timestamp    NOT NULL DEFAULT now(),

    CONSTRAINT fk_nft_photocard_designs_performance
        FOREIGN KEY (performance_general_id) REFERENCES performance_general (id),
    CONSTRAINT chk_nft_photocard_designs_total_supply
        CHECK (total_supply > 0),
    CONSTRAINT chk_nft_photocard_designs_issued_supply
        CHECK (issued_supply >= 0 AND issued_supply <= total_supply)
);

CREATE TABLE nft_photocards
(
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    design_id        bigint          NOT NULL,
    ticket_id        bigint          NOT NULL,
    owner_id         bigint          NOT NULL,
    wallet_id        bigint,
    metadata_uri     text,
    chain_id         int,
    contract_address char(42),
    token_id         numeric(78, 0),
    mint_tx_hash     char(66),
    status           nft_mint_status NOT NULL DEFAULT 'PENDING',
    minted_at        timestamp,
    created_at       timestamp       NOT NULL DEFAULT now(),
    updated_at       timestamp       NOT NULL DEFAULT now(),

    CONSTRAINT fk_nft_photocards_design
        FOREIGN KEY (design_id) REFERENCES nft_photocard_designs (id),
    CONSTRAINT fk_nft_photocards_ticket
        FOREIGN KEY (ticket_id) REFERENCES tickets (id),
    CONSTRAINT fk_nft_photocards_owner
        FOREIGN KEY (owner_id) REFERENCES users (id),
    CONSTRAINT fk_nft_photocards_wallet
        FOREIGN KEY (wallet_id) REFERENCES wallets (id),
    CONSTRAINT uq_nft_photocards_ticket
        UNIQUE (ticket_id),
    CONSTRAINT uq_nft_photocards_contract_token
        UNIQUE (chain_id, contract_address, token_id),
    CONSTRAINT chk_nft_photocards_address_lower
        CHECK (contract_address IS NULL OR contract_address = lower(contract_address)),
    CONSTRAINT chk_nft_photocards_chain_fields
        CHECK ((chain_id IS NULL AND contract_address IS NULL AND token_id IS NULL)
            OR (chain_id IS NOT NULL AND contract_address IS NOT NULL AND token_id IS NOT NULL))
);

CREATE TABLE nft_photocard_listings
(
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    photocard_id bigint                        NOT NULL,
    seller_id    bigint                        NOT NULL,
    price        bigint                        NOT NULL,
    description  varchar(500)                  NOT NULL,
    status       nft_photocard_listing_status NOT NULL DEFAULT 'ACTIVE',
    listed_at    timestamp                     NOT NULL DEFAULT now(),
    closed_at    timestamp,

    CONSTRAINT fk_nft_photocard_listings_photocard
        FOREIGN KEY (photocard_id) REFERENCES nft_photocards (id),
    CONSTRAINT fk_nft_photocard_listings_seller
        FOREIGN KEY (seller_id) REFERENCES users (id),
    CONSTRAINT chk_nft_photocard_listings_price
        CHECK (price > 0),
    CONSTRAINT chk_nft_photocard_listings_closed_at
        CHECK ((status = 'ACTIVE' AND closed_at IS NULL)
            OR (status <> 'ACTIVE' AND closed_at IS NOT NULL))
);

CREATE TABLE nft_photocard_trades
(
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id      bigint    NOT NULL,
    photocard_id    bigint    NOT NULL,
    seller_id       bigint    NOT NULL,
    buyer_id        bigint    NOT NULL,
    price           bigint    NOT NULL,
    idempotency_key uuid      NOT NULL,
    traded_at       timestamp NOT NULL DEFAULT now(),

    CONSTRAINT fk_nft_photocard_trades_listing
        FOREIGN KEY (listing_id) REFERENCES nft_photocard_listings (id),
    CONSTRAINT fk_nft_photocard_trades_photocard
        FOREIGN KEY (photocard_id) REFERENCES nft_photocards (id),
    CONSTRAINT fk_nft_photocard_trades_seller
        FOREIGN KEY (seller_id) REFERENCES users (id),
    CONSTRAINT fk_nft_photocard_trades_buyer
        FOREIGN KEY (buyer_id) REFERENCES users (id),
    CONSTRAINT uq_nft_photocard_trades_listing
        UNIQUE (listing_id),
    CONSTRAINT uq_nft_photocard_trades_buyer_idempotency
        UNIQUE (buyer_id, idempotency_key),
    CONSTRAINT chk_nft_photocard_trades_price
        CHECK (price > 0),
    CONSTRAINT chk_nft_photocard_trades_parties
        CHECK (seller_id <> buyer_id)
);

-- 판매 목록 keyset pagination 및 필터
CREATE UNIQUE INDEX uq_nft_photocard_listings_active
    ON nft_photocard_listings (photocard_id)
    WHERE status = 'ACTIVE';
CREATE INDEX idx_nft_photocard_listings_photocard_id
    ON nft_photocard_listings (photocard_id);
CREATE INDEX idx_nft_photocard_listings_active_recent
    ON nft_photocard_listings (listed_at DESC, id DESC)
    WHERE status = 'ACTIVE';
CREATE INDEX idx_nft_photocard_listings_active_price
    ON nft_photocard_listings (price, id)
    WHERE status = 'ACTIVE';

-- 보유 목록, 공연 필터, 검색
CREATE INDEX idx_nft_photocards_owner_created
    ON nft_photocards (owner_id, created_at DESC, id DESC);
CREATE INDEX idx_nft_photocards_design_id ON nft_photocards (design_id);
CREATE INDEX idx_nft_photocard_designs_performance
    ON nft_photocard_designs (performance_general_id);
CREATE INDEX idx_nft_photocard_designs_name_trgm
    ON nft_photocard_designs USING gin (name gin_trgm_ops);

-- 구매/판매/카드별 거래 내역 keyset pagination
CREATE INDEX idx_nft_photocard_trades_buyer_history
    ON nft_photocard_trades (buyer_id, traded_at DESC, id DESC);
CREATE INDEX idx_nft_photocard_trades_seller_history
    ON nft_photocard_trades (seller_id, traded_at DESC, id DESC);
CREATE INDEX idx_nft_photocard_trades_card_history
    ON nft_photocard_trades (photocard_id, traded_at DESC, id DESC);
