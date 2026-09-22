-- 포카 꾸미기 — 내 포토카드에 AI 스티커를 얹은 결과.
--
-- 🔴 원본 nft_photocards 는 건드리지 않는다. NFT 라 되돌릴 수 없다. 꾸민 사본을 여기 따로 둔다.
--
-- 🔴 UNIQUE 는 (photocard_id, user_id) **두 칸**이다. photocard_id 하나만 잠그면
--    카드가 팔려 주인이 바뀐 뒤 **새 주인이 그 카드를 못 꾸민다** — 자리가 남의 행으로 차 있다.
--    "사람마다 자기 것" 이 맞는 규칙이고, 코드가 아니라 제약으로 건다
--    (서비스에서만 막으면 동시 요청 둘이 통과한다).
--
-- 🔴 읽을 때는 **언제나 user_id 로 함께 거른다.** 카드 기준으로만 읽으면 주인이 바뀐 뒤
--    새 주인 화면에 예전 주인의 그림이 뜬다. 유출을 막는 실제 장치가 이것이고,
--    판매 정산 때의 삭제는 저장공간 정리다.
CREATE TABLE photocard_decorations (
    id            BIGSERIAL    PRIMARY KEY,
    photocard_id  BIGINT       NOT NULL REFERENCES nft_photocards (id),
    user_id       BIGINT       NOT NULL REFERENCES users (id),
    -- MinIO 키. presigned URL 은 만료되므로 저장하지 않고 조회할 때마다 만든다
    image_key     VARCHAR(512) NOT NULL,
    -- 다시 꾸미기용 배치 정보(JSON 배열). 서버는 내용을 해석하지 않고 그대로 보관한다
    placements    JSONB        NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_photocard_decorations_card_user UNIQUE (photocard_id, user_id)
);

-- 내 카드 목록을 그릴 때 사용자별로 훑는다
CREATE INDEX idx_photocard_decorations_user ON photocard_decorations (user_id);
