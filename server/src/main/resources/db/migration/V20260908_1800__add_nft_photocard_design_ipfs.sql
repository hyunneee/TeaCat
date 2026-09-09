-- ================================
-- 포토카드 도안: IPFS 핀 결과와 온체인 등록 상태
-- ================================
-- 지금까지 도안은 DB 에 직접 INSERT 해야만 생겼고, 그림은 image_url 하나로 끝이었다.
-- 그러면 "한정 100장" 은 체인이 지키는데 "무슨 그림인가" 는 DB 가 언제든 바꿀 수 있어
-- 비대칭이다. CID 가 그 자리를 메운다 — 내용 주소라 그림을 바꾸면 값이 달라진다.
-- (blockchain/PHOTOCARD_PLAN.md 3장 · 6-2)

CREATE TYPE nft_design_chain_status AS ENUM ('PENDING', 'REGISTERING', 'REGISTERED', 'FAILED');

ALTER TABLE nft_photocard_designs
    ADD COLUMN image_cid        varchar(80),
    ADD COLUMN metadata_cid     varchar(80),
    ADD COLUMN chain_status     nft_design_chain_status NOT NULL DEFAULT 'PENDING',
    ADD COLUMN chain_id         int,
    ADD COLUMN contract_address char(42),
    ADD COLUMN register_tx_hash char(66),
    ADD COLUMN registered_at    timestamp,
    -- CID 없이는 등록 요청을 보낼 수 없다. 둘 다 있거나 둘 다 없거나다
    ADD CONSTRAINT chk_nft_photocard_designs_cids
        CHECK ((image_cid IS NULL) = (metadata_cid IS NULL)),
    ADD CONSTRAINT chk_nft_photocard_designs_address_lower
        CHECK (contract_address IS NULL OR contract_address = lower(contract_address));

-- 확정 감시가 훑는 대상: 트랜잭션을 보내놓고 아직 확정을 못 본 도안
CREATE INDEX idx_nft_photocard_designs_registering
    ON nft_photocard_designs (id)
    WHERE chain_status = 'REGISTERING';
