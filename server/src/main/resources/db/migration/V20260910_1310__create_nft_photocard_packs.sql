-- ================================
-- 카드팩: 한 행 = 팩 한 개
-- ================================
-- 잔액 컬럼을 따로 두면 지급 이력과 어긋날 수 있고, users 행을 잠그면 로그인·프로필 수정과
-- 경합한다. 팩 한 개가 한 행이면 "어느 지급분을 어느 뽑기에 썼는지" 가 그대로 남고,
-- 뽑기가 잠그는 것은 그 한 행이다. 잔액 = COUNT(*) WHERE consumed_at IS NULL.

-- 어디서 받은 팩인가. TICKET_ENTRY 는 다음 작업(입장 확인)이 쓴다 —
-- 머지된 마이그레이션은 수정 금지라 ENUM 값을 지금 판다
CREATE TYPE nft_photocard_pack_source AS ENUM ('TICKET_ENTRY', 'EVENT');

CREATE TABLE nft_photocard_packs
(
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         bigint                    NOT NULL,
    source          nft_photocard_pack_source NOT NULL,
    source_ref      varchar(100)              NOT NULL,  -- 티켓 id 또는 이벤트 코드
    granted_at      timestamp                 NOT NULL DEFAULT now(),
    consumed_at     timestamp,
    photocard_id    bigint,                              -- 이 팩으로 뽑은 카드
    idempotency_key uuid,                                -- 그 뽑기 요청의 Idempotency-Key

    CONSTRAINT fk_nft_photocard_packs_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_nft_photocard_packs_photocard
        FOREIGN KEY (photocard_id) REFERENCES nft_photocards (id),
    -- 같은 출처로 두 번 주지 않는다. "이벤트 계정당 1개" 가 여기서 지켜진다
    CONSTRAINT uq_nft_photocard_packs_source
        UNIQUE (user_id, source, source_ref),
    -- 안 썼으면 결과도 키도 없고, 썼으면 둘 다 있다
    CONSTRAINT chk_nft_photocard_packs_consumed
        CHECK ((consumed_at IS NULL) = (photocard_id IS NULL)
           AND (consumed_at IS NULL) = (idempotency_key IS NULL))
);

-- 같은 키로 두 번 뽑지 않는다 (더블탭·재시도)
CREATE UNIQUE INDEX uq_nft_photocard_packs_idempotency
    ON nft_photocard_packs (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
-- 남은 팩 세기 · 하나 잠그기
CREATE INDEX idx_nft_photocard_packs_available
    ON nft_photocard_packs (user_id, id)
    WHERE consumed_at IS NULL;
