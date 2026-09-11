-- ================================
-- 카드팩 이벤트
-- ================================
-- 이벤트가 application.yaml 값 하나였다. 비우면 닫히고 바꾸면 새 이벤트인데, 둘 다 서버
-- 재시작이 필요해 어드민 화면에서 다룰 수 없었다. 표로 옮긴다.

CREATE TABLE nft_photocard_pack_events
(
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- 🔴 nft_photocard_packs.source_ref 에 그대로 들어간다. 계정당 1회의 기준이 이 값이다.
    --    이미 지급이 일어난 이벤트의 code 를 바꾸면 이미 받은 사람이 또 받는다 —
    --    그래서 수정 API 를 열지 않는다.
    code       varchar(50)  NOT NULL UNIQUE,
    name       varchar(100) NOT NULL,
    starts_at  timestamp,                      -- NULL 이면 즉시
    ends_at    timestamp,                      -- NULL 이면 무기한
    active     boolean      NOT NULL DEFAULT true,
    created_at timestamp    NOT NULL DEFAULT now()
);

-- 지금 설정값으로 돌고 있던 이벤트를 한 행으로 옮긴다.
-- 이 행이 있어야 이미 OPEN_EVENT 로 받은 사람들이 또 받지 않는다 (source_ref 가 이어진다).
INSERT INTO nft_photocard_pack_events (code, name, starts_at, ends_at, active)
VALUES ('OPEN_EVENT', '오픈 기념 카드팩', NULL, NULL, true);
