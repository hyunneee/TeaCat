-- ================================
-- 포토카드 템플릿: 그림만. 수량과 체인은 도안이 갖는다
-- ================================
-- 지금까지 "도안" 하나가 그림이면서 발행 단위였다. 그래서 등록하는 순간 수량이 필요하고
-- 온체인 등록까지 나가서, 20종을 등록하면 쓰지 않을 것까지 20개가 체인에 박혔다(되돌릴 수 없다).
--
-- 층을 가른다 — 템플릿은 그림이고, 도안은 "템플릿 + 수량 + 쓰이는 곳" 이다.
-- 공연에 넣기와 이벤트에 넣기가 같은 동작이 되고, 안 쓰는 카드는 체인에 올라가지 않는다.

CREATE TABLE nft_photocard_templates
(
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        varchar(100)        NOT NULL,
    description varchar(500),
    -- 🔴 도안들이 이 CID 를 그대로 가리킨다. 템플릿을 지우거나 언핀하면 그 그림을 쓰는
    --    모든 도안의 이미지가 깨진다. 그래서 삭제를 두지 않고 hidden 으로 감춘다
    image_cid   varchar(100)        NOT NULL,
    -- ipfs:// 는 브라우저가 못 연다. 화면이 그대로 쓰도록 게이트웨이 주소를 넣는다
    image_url   text                NOT NULL,
    group_name  varchar(50)         NOT NULL,
    grade       nft_photocard_grade NOT NULL,
    hidden      boolean             NOT NULL DEFAULT false,
    created_at  timestamp           NOT NULL DEFAULT now()
);

-- 어드민 목록: 감추지 않은 것만 최신순
CREATE INDEX idx_nft_photocard_templates_visible
    ON nft_photocard_templates (id DESC)
    WHERE NOT hidden;
