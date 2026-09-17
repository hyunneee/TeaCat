-- PostgreSQL은 ADD VALUE 한 새 ENUM 값을 같은 트랜잭션에서 사용할 수 없다.
-- 값 추가만 먼저 커밋하고 다음 마이그레이션에서 컬럼·제약을 확장한다.

ALTER TYPE nft_photocard_listing_status ADD VALUE IF NOT EXISTS 'SETTLING';
ALTER TYPE nft_auction_status ADD VALUE IF NOT EXISTS 'SETTLING';
ALTER TYPE cat_money_hold_ref_type ADD VALUE IF NOT EXISTS 'NFT_TRADE_BUYER';
ALTER TYPE cat_money_hold_ref_type ADD VALUE IF NOT EXISTS 'NFT_TRADE_SELLER';
