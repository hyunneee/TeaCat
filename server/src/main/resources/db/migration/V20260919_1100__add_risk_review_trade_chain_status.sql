-- 이상거래 심사(AUCTION_FRAUD_DESIGN.md 6-1): 규칙에 걸린 거래는 체인에 나가기 전에 여기서 멈춘다.
-- PostgreSQL 은 ADD VALUE 한 새 ENUM 값을 같은 트랜잭션에서 쓸 수 없다.
-- 값 추가만 먼저 커밋하고 다음 마이그레이션에서 컬럼·테이블을 만든다 (V20260916_1100 과 같은 이유).
ALTER TYPE nft_trade_chain_status ADD VALUE IF NOT EXISTS 'RISK_REVIEW';
