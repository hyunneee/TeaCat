-- ================================
-- 포토카드: 한 행 = 한 토큰이 더 이상 아니다
-- ================================
-- ERC-1155 로 가면서 tokenId 가 카드가 아니라 **도안**이 됐다. 같은 도안 100장은
-- 전부 같은 (chain_id, contract_address, token_id) 을 갖는다 — 체인에서 구별되지
-- 않기 때문이다. 그래서 UNIQUE 가 두 장째부터 발행을 막는다.
-- (blockchain/PHOTOCARD_PLAN.md 6-2 · 2장 A)

ALTER TABLE nft_photocards
    DROP CONSTRAINT uq_nft_photocards_contract_token;

-- UNIQUE 를 걷어낸 자리. "이 행이 가리키는 온체인 토큰" 을 찾는 조회는 남는다
CREATE INDEX idx_nft_photocards_chain_token
    ON nft_photocards (chain_id, contract_address, token_id);

-- 대사(reconciliation)가 실제로 쓰는 인덱스: 유저 × 도안 개수 세기.
-- 온체인 balanceOf(address, designId) 와 맞춰본다
CREATE INDEX idx_nft_photocards_owner_design
    ON nft_photocards (owner_id, design_id)
    WHERE status = 'MINTED';

-- 발행 재시도가 훑는 대상: 행은 만들어졌는데 아직 체인에 안 보낸 카드
CREATE INDEX idx_nft_photocards_pending_mint
    ON nft_photocards (design_id, id)
    WHERE status = 'PENDING';

-- 아무도 채우지 않는 컬럼이다. batchIssuePhotocards 가 넣지 않고 세터도 없다.
-- 메타데이터는 도안 단위(uri(tokenId))라, 채우면 카드 100장에 같은 값이 100벌 생긴다
ALTER TABLE nft_photocards
    DROP COLUMN metadata_uri;
