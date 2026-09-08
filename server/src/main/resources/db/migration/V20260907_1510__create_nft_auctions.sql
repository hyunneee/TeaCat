-- ================================
-- NFT 포토카드 경매 (공개 오름 입찰)
-- ================================
--
-- 고정가 판매(nft_photocard_listings)와 나란히 둔다. 포카 한 장은 고정가 또는 경매 중 하나에만
-- 올라갈 수 있는데, 두 테이블에 걸친 조건이라 인덱스로는 못 막는다 — 두 등록 경로가 모두
-- 포카 행을 FOR UPDATE 로 먼저 잡은 뒤 상대 테이블을 확인한다 (NftService.registerListing,
-- NftAuctionService.createAuction).

CREATE TYPE nft_auction_status AS ENUM ('ACTIVE', 'SOLD', 'EXPIRED', 'CANCELLED');

CREATE TABLE nft_auctions
(
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    photocard_id  bigint             NOT NULL,
    seller_id     bigint             NOT NULL,
    start_price   bigint             NOT NULL,
    buy_now_price bigint,
    -- 비정규화: 목록 정렬·표시용. 진실은 top_bid_id 가 가리키는 입찰의 amount 다.
    -- SOLD 가 되면 체결가(낙찰가 또는 즉시구매가)가 들어간다
    current_price bigint             NOT NULL,
    top_bid_id    bigint,
    bid_count     int                NOT NULL DEFAULT 0,
    ends_at       timestamp          NOT NULL,
    status        nft_auction_status NOT NULL DEFAULT 'ACTIVE',
    winner_id     bigint,
    created_at    timestamp          NOT NULL DEFAULT now(),
    updated_at    timestamp          NOT NULL DEFAULT now(),
    closed_at     timestamp,

    CONSTRAINT fk_nft_auctions_photocard FOREIGN KEY (photocard_id) REFERENCES nft_photocards (id),
    CONSTRAINT fk_nft_auctions_seller    FOREIGN KEY (seller_id)    REFERENCES users (id),
    CONSTRAINT fk_nft_auctions_winner    FOREIGN KEY (winner_id)    REFERENCES users (id),
    CONSTRAINT chk_nft_auctions_start_price   CHECK (start_price > 0),
    CONSTRAINT chk_nft_auctions_buy_now_price CHECK (buy_now_price IS NULL OR buy_now_price > start_price),
    CONSTRAINT chk_nft_auctions_current_price CHECK (current_price >= start_price),
    CONSTRAINT chk_nft_auctions_closed
        CHECK ((status = 'ACTIVE' AND closed_at IS NULL) OR (status <> 'ACTIVE' AND closed_at IS NOT NULL)),
    -- 낙찰자는 SOLD 일 때만, SOLD 면 반드시
    CONSTRAINT chk_nft_auctions_winner
        CHECK ((status = 'SOLD') = (winner_id IS NOT NULL))
);

CREATE TABLE nft_auction_bids
(
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    auction_id bigint    NOT NULL,
    bidder_id  bigint    NOT NULL,
    amount     bigint    NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),

    CONSTRAINT fk_nft_auction_bids_auction FOREIGN KEY (auction_id) REFERENCES nft_auctions (id),
    CONSTRAINT fk_nft_auction_bids_bidder  FOREIGN KEY (bidder_id)  REFERENCES users (id),
    CONSTRAINT chk_nft_auction_bids_amount CHECK (amount > 0)
);

-- 입찰의 담보는 cat_money_holds (ref_type = 'AUCTION_BID', ref_id = 이 테이블의 id) 에 있다.
-- 여기서 홀드를 가리키지 않는 이유: 서로 NOT NULL 로 가리키면 어느 쪽도 먼저 INSERT 할 수 없고,
-- wallet 이 nft 테이블에 FK 를 걸면 도메인 의존이 거꾸로 된다.

ALTER TABLE nft_auctions
    ADD CONSTRAINT fk_nft_auctions_top_bid FOREIGN KEY (top_bid_id) REFERENCES nft_auction_bids (id);

-- 포카 1장 = 진행 중 경매 최대 1건
CREATE UNIQUE INDEX uq_nft_auctions_active ON nft_auctions (photocard_id) WHERE status = 'ACTIVE';

-- 목록 정렬 (keyset pagination)
CREATE INDEX idx_nft_auctions_active_ending ON nft_auctions (ends_at, id)              WHERE status = 'ACTIVE';
CREATE INDEX idx_nft_auctions_active_price  ON nft_auctions (current_price, id)        WHERE status = 'ACTIVE';
CREATE INDEX idx_nft_auctions_active_recent ON nft_auctions (created_at DESC, id DESC) WHERE status = 'ACTIVE';
-- 내가 올린 경매
CREATE INDEX idx_nft_auctions_seller ON nft_auctions (seller_id, created_at DESC, id DESC);
-- 입찰 이력(경매별 최신순) · 내가 입찰한 경매
CREATE INDEX idx_nft_auction_bids_auction ON nft_auction_bids (auction_id, id DESC);
CREATE INDEX idx_nft_auction_bids_bidder  ON nft_auction_bids (bidder_id, id DESC);

-- 낙찰을 기존 거래 이력에 편입한다. 출처는 고정가(listing) 또는 경매(auction) 중 정확히 하나.
-- 구매/판매 내역·카드별 거래 이력 API 가 수정 없이 경매 결과를 보여주게 된다.
ALTER TABLE nft_photocard_trades
    ALTER COLUMN listing_id DROP NOT NULL,
    ADD COLUMN auction_id bigint,
    ADD CONSTRAINT fk_nft_photocard_trades_auction FOREIGN KEY (auction_id) REFERENCES nft_auctions (id),
    ADD CONSTRAINT uq_nft_photocard_trades_auction UNIQUE (auction_id),
    ADD CONSTRAINT chk_nft_photocard_trades_source
        CHECK ((listing_id IS NOT NULL) <> (auction_id IS NOT NULL));
