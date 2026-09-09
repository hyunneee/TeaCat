-- ================================
-- 메인 슬라이드(배너)
-- ================================

-- IMAGE       직접 올린 이미지 + 상대 경로 링크
-- PERFORMANCE 공연을 지정 — 이미지는 공연 포스터, 링크는 공연 상세로 간다
CREATE TYPE main_banner_type AS ENUM ('IMAGE', 'PERFORMANCE');

CREATE TABLE main_banners
(
    id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type                   main_banner_type NOT NULL,

    title                  varchar(60)      NOT NULL,
    subtitle               varchar(100),
    -- 좌상단 라벨 (EVENT / NEW 등)
    label                  varchar(20),

    -- IMAGE 일 때만. 스토리지 key 를 저장하고 URL 은 조회할 때 만든다
    image_key              varchar(255),
    -- PERFORMANCE 일 때만
    performance_general_id bigint,
    -- IMAGE 일 때 선택. 비우면 눌러도 이동하지 않는다
    link_path              varchar(255),

    sort_order             int              NOT NULL,
    active                 boolean          NOT NULL DEFAULT true,

    created_at             timestamp        NOT NULL DEFAULT now(),
    updated_at             timestamp        NOT NULL DEFAULT now(),

    CONSTRAINT fk_main_banners_performance
        FOREIGN KEY (performance_general_id) REFERENCES performance_general (id),

    -- 타입마다 채워야 할 칸이 다르다. 섞이면 화면이 무엇을 그릴지 알 수 없다
    CONSTRAINT chk_main_banners_source
        CHECK ((type = 'IMAGE' AND image_key IS NOT NULL AND performance_general_id IS NULL)
            OR (type = 'PERFORMANCE' AND performance_general_id IS NOT NULL
                AND image_key IS NULL AND link_path IS NULL)),

    -- 우리 서비스 안의 상대 경로만 허용한다.
    --   '//evil.com' 은 슬래시로 시작하지만 브라우저가 외부 주소로 읽는다. 그래서 따로 막는다
    CONSTRAINT chk_main_banners_link_path
        CHECK (link_path IS NULL
            OR (link_path LIKE '/%' AND link_path NOT LIKE '//%'))
);

-- 홈은 활성 배너만 순서대로 읽는다
CREATE INDEX idx_main_banners_active_order ON main_banners (active, sort_order);
