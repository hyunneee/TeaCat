-- 잘못 지급된 카드팩도 지급 이력과 중복 지급 방지 키를 보존한 채 운영에서 제외한다.
-- 삭제하면 (user_id, source, source_ref) UNIQUE 이력까지 사라져 같은 팩이 다시 지급될 수 있다.
ALTER TABLE nft_photocard_packs
    ADD COLUMN invalidated_at timestamp,
    ADD COLUMN invalidated_reason varchar(500),
    ADD COLUMN invalidated_by bigint REFERENCES users (id),
    ADD CONSTRAINT chk_nft_photocard_packs_invalidation
        CHECK (
            (invalidated_at IS NULL AND invalidated_reason IS NULL AND invalidated_by IS NULL)
            OR
            (invalidated_at IS NOT NULL AND invalidated_reason IS NOT NULL AND invalidated_by IS NOT NULL
                AND consumed_at IS NULL)
        );

-- 사용자 화면과 개봉 쿼리는 무효화되지 않은 미사용 팩만 반복해서 찾는다.
CREATE INDEX idx_nft_photocard_packs_drawable
    ON nft_photocard_packs (user_id, id)
    WHERE consumed_at IS NULL AND invalidated_at IS NULL;
