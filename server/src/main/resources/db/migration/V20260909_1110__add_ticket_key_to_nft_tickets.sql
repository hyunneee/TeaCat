-- ================================
-- 티켓 SBT 발행 키
-- ================================
-- 결제가 끝나 티켓이 발권되면 nft_tickets 행을 만들고 블록체인 서비스에 SBT 발행을 요청한다.
-- 확정(블록 10초)은 Spring 이 기다리지 않는다 — **블록체인 서비스가 대신 기다렸다가
-- 이 테이블의 결과 컬럼을 직접 갱신한다** (blockchain/DESIGN.md 1장 "예외 하나").
--
-- ── 컬럼 소유권 ────────────────────────────────────────────────
--   블록체인 서비스가 쓴다 : status · token_id · chain_id* · contract_address ·
--                            mint_tx_hash · burn_tx_hash · minted_at
--   Spring 이 쓴다        : ticket_id · wallet_id · ticket_key  (*chain_id 는 발급 때 우리가 넣는다)
--
-- 🔴 엔티티에서 저쪽 소유 컬럼은 반드시 updatable = false 로 둔다.
--    안 그러면 로드해 둔 엔티티가 flush 되면서 저쪽 UPDATE 를 덮어쓴다.

ALTER TABLE nft_tickets
    -- 발행 멱등 키. Spring 이 만들고, 블록체인 서비스가 그대로 keccak256 해서 온체인
    -- tokenId 를 만든다. 이 값으로 찾지 않으면 체인과 DB 를 이을 수 없다.
    --
    --   PK(순번) 대신 UUID 다. 순번은 두 가지가 깨진다 —
    --     1. 개발 중 DB 를 밀면 같은 번호가 재사용되는데 공용 체인은 못 밀어서
    --        그 키가 AlreadyIssued 로 영구히 막힌다
    --     2. 남의 키를 추측해 미리 태워 발행을 막을 수 있다
    --
    --   🔴 기본값을 두지 않는다. 값은 Spring 이 반드시 정해야 한다 — DB 가 임의로 채우면
    --      체인에 올라간 키와 달라져 그 행은 영영 못 잇는다.
    ADD COLUMN ticket_key   uuid NOT NULL,
    -- 예매 취소로 소각한 트랜잭션
    ADD COLUMN burn_tx_hash char(66),
    ADD CONSTRAINT uq_nft_tickets_ticket_key UNIQUE (ticket_key),
    ADD CONSTRAINT chk_nft_tickets_burn_tx_hash_lower
        CHECK (burn_tx_hash IS NULL OR burn_tx_hash = lower(burn_tx_hash));

-- 블록체인 서비스의 훑기(sweep)가 타는 경로.
--   "아직 확정 안 된 행을 오래된 것부터" 읽어 체인에 직접 물어본다.
--   그 서비스가 재시작해 추적 목록을 잃어도 이 인덱스로 복구된다
CREATE INDEX idx_nft_tickets_unsettled
    ON nft_tickets (updated_at) WHERE status IN ('PENDING', 'MINTING');
