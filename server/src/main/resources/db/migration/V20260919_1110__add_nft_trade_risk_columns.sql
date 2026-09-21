-- 이상거래 심사용 요청 메타데이터 (AUCTION_FRAUD_DESIGN.md 5-1).
-- 부계정 판별에는 "누가 어느 단말에서 요청했나" 가 필요하다. IP 원문은 varchar(45)(IPv6 최대 길이)로,
-- User-Agent 는 원문 대신 SHA-256 해시만 둔다 — 같은 브라우저인지만 알면 된다.
-- 전부 NULL 허용이라 기존 행에는 영향이 없고, 규칙은 NULL 을 "판단 불가" 로 본다.

ALTER TABLE nft_auction_bids
    ADD COLUMN client_ip       varchar(45),
    ADD COLUMN user_agent_hash char(64);

ALTER TABLE nft_auctions
    ADD COLUMN client_ip       varchar(45),
    ADD COLUMN user_agent_hash char(64);

ALTER TABLE nft_photocard_listings
    ADD COLUMN client_ip       varchar(45),
    ADD COLUMN user_agent_hash char(64);

-- 즉시구매·고정가 구매 요청의 단말. 자연 낙찰은 최고 입찰 행에서 읽으므로 여기가 NULL 이다.
-- risk_screened_at 은 정산 프로세서가 "심사를 했나" 를 판단하는 기준이다. NULL 이면 체인 전송 전에 심사한다.
ALTER TABLE nft_photocard_trades
    ADD COLUMN client_ip        varchar(45),
    ADD COLUMN user_agent_hash  char(64),
    ADD COLUMN risk_screened_at timestamp;

-- R3(반복 거래쌍) · R4·R6(시세·거래량) · R7(매집) 이 완료된 거래를 계정 쌍·카드·도안 기준으로 훑는다.
CREATE INDEX idx_nft_photocard_trades_completed_pair
    ON nft_photocard_trades (seller_id, buyer_id, completed_at)
    WHERE chain_status = 'COMPLETED';

CREATE INDEX idx_nft_photocard_trades_completed_photocard
    ON nft_photocard_trades (photocard_id, completed_at)
    WHERE chain_status = 'COMPLETED';
