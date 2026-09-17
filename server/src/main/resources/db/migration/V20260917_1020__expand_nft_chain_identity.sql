-- 온체인 식별자를 관계형 PK와 분리한다. 첫 배포는 nullable/fallback을 유지한다.
ALTER TABLE nft_photocards
    ADD COLUMN issue_key varchar(64),
    ADD COLUMN mint_failure_code varchar(100);

ALTER TABLE nft_photocard_designs
    ADD COLUMN chain_token_id numeric(78, 0);

-- 이미 제출된 카드는 체인에 보낸 숫자 키를 절대 바꾸지 않는다.
UPDATE nft_photocards
   SET issue_key = id::text
 WHERE status IN ('MINTING', 'MINTED', 'FAILED')
    OR mint_tx_hash IS NOT NULL;

-- 한 번도 제출되지 않은 기존 카드는 첫 제출 전에 전역 UUID 키를 받는다.
UPDATE nft_photocards
   SET issue_key = gen_random_uuid()::text
 WHERE issue_key IS NULL
   AND status = 'PENDING'
   AND mint_tx_hash IS NULL;

-- 구 버전 애플리케이션이 INSERT 해도 새 카드는 UUID 키를 받는다.
ALTER TABLE nft_photocards
    ALTER COLUMN issue_key SET DEFAULT gen_random_uuid()::text;

-- 등록 요청 이력이 있는 레거시 도안만 기존 DB PK를 온체인 tokenId로 보존한다.
UPDATE nft_photocard_designs
   SET chain_token_id = id
 WHERE chain_status IN ('REGISTERING', 'REGISTERED')
    OR register_tx_hash IS NOT NULL;

CREATE UNIQUE INDEX uq_nft_photocards_issue_key
    ON nft_photocards (issue_key)
    WHERE issue_key IS NOT NULL;

CREATE UNIQUE INDEX uq_nft_photocard_designs_chain_token_id
    ON nft_photocard_designs (chain_token_id)
    WHERE chain_token_id IS NOT NULL;

ALTER TABLE nft_photocard_designs
    ADD CONSTRAINT chk_nft_photocard_designs_chain_token_positive
        CHECK (chain_token_id IS NULL OR chain_token_id > 0);
