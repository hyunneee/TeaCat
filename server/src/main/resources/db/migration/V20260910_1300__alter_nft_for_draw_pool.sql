-- ================================
-- 포토카드 뽑기: 공연에 속하지 않는 "뽑기 풀" 도안, 티켓 없는 카드
-- ================================
-- 뽑기로 나오는 카드는 어느 공연·티켓에도 속하지 않는다. 도안은 draw_pool 로 표시하고
-- 공연 FK 를 선택으로 바꾼다. 풀은 하나고 도안만 늘어난다. 확률은 균등이며 희귀도는
-- 어드민이 total_supply 로 조절한다 — 소진된 도안은 후보에서 빠진다.

-- 화면 연출용 등급. 화면은 이 값 하나만 보고 금색/보라(SPECIAL) · 먼지(COMMON) 를 고른다
CREATE TYPE nft_photocard_grade AS ENUM ('COMMON', 'SPECIAL');

ALTER TABLE nft_photocard_designs
    ALTER COLUMN performance_general_id DROP NOT NULL,
    ADD COLUMN draw_pool  boolean NOT NULL DEFAULT false,
    ADD COLUMN group_name varchar(50),
    ADD COLUMN grade      nft_photocard_grade,
    -- 공연 도안이거나 뽑기 풀이거나, 둘 중 하나다
    ADD CONSTRAINT chk_nft_photocard_designs_pool
        CHECK ((performance_general_id IS NOT NULL) <> draw_pool),
    -- 뽑기 풀 도안은 소속·등급이 있어야 한다
    ADD CONSTRAINT chk_nft_photocard_designs_pool_attrs
        CHECK (NOT draw_pool OR (group_name IS NOT NULL AND grade IS NOT NULL));

-- 뽑기 후보 조회: 등록된 풀 도안
CREATE INDEX idx_nft_photocard_designs_draw_pool
    ON nft_photocard_designs (id)
    WHERE draw_pool AND chain_status = 'REGISTERED';

-- 뽑은 카드에는 티켓이 없다. "티켓 한 장에 카드 한 장" 은 티켓이 있는 카드에만 건다
ALTER TABLE nft_photocards ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE nft_photocards DROP CONSTRAINT uq_nft_photocards_ticket;
CREATE UNIQUE INDEX uq_nft_photocards_ticket
    ON nft_photocards (ticket_id) WHERE ticket_id IS NOT NULL;

-- 체인 전송을 못 한 뽑기 카드를 재전송 스위퍼가 훑는 대상.
-- 기존 idx_nft_photocards_pending_mint 는 공연 발급용(design_id 순)이라 그대로 두고 따로 판다
CREATE INDEX idx_nft_photocards_pending_draw
    ON nft_photocards (id)
    WHERE status = 'PENDING' AND ticket_id IS NULL;
