-- ================================
-- 문의 (오류 신고 · 개선 제안 · 기타)
-- ================================

CREATE TYPE inquiry_type AS ENUM ('BUG', 'IMPROVEMENT', 'ETC');

-- OPEN 접수 → ANSWERED 답변 완료 → RESOLVED 해결
-- 상태를 바꾸는 것은 관리자뿐이다
CREATE TYPE inquiry_status AS ENUM ('OPEN', 'ANSWERED', 'RESOLVED');

CREATE TABLE inquiries
(
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     bigint         NOT NULL,
    type        inquiry_type   NOT NULL,
    title       varchar(100)   NOT NULL,
    content     text           NOT NULL,
    status      inquiry_status NOT NULL DEFAULT 'OPEN',

    -- 답변은 하나뿐이다. 여러 번 주고받는 대화가 필요해지면 별도 테이블로 옮긴다
    answer      text,
    answered_by bigint,
    answered_at timestamp,
    resolved_at timestamp,

    created_at  timestamp      NOT NULL DEFAULT now(),
    updated_at  timestamp      NOT NULL DEFAULT now(),

    CONSTRAINT fk_inquiries_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_inquiries_answered_by
        FOREIGN KEY (answered_by) REFERENCES users (id),

    -- 답변 세 컬럼은 항상 함께 있거나 함께 없다
    CONSTRAINT chk_inquiries_answer_together
        CHECK ((answer IS NULL AND answered_by IS NULL AND answered_at IS NULL)
            OR (answer IS NOT NULL AND answered_by IS NOT NULL AND answered_at IS NOT NULL)),
    -- 답변 없이 ANSWERED·RESOLVED 로 갈 수 없다
    CONSTRAINT chk_inquiries_status_needs_answer
        CHECK (status = 'OPEN' OR answer IS NOT NULL),
    -- 해결 시각은 RESOLVED 일 때만 있다
    CONSTRAINT chk_inquiries_resolved_at
        CHECK ((status = 'RESOLVED') = (resolved_at IS NOT NULL))
);

-- 내 문의 목록 (최신순)
CREATE INDEX idx_inquiries_user_created ON inquiries (user_id, created_at DESC);
-- 관리자 목록 (상태 필터 + 최신순)
CREATE INDEX idx_inquiries_status_created ON inquiries (status, created_at DESC);
