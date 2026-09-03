-- ================================
-- 외부 계정(SSAFY) 로그인 연동
-- ================================

-- 소셜 전용 계정은 비밀번호가 없다
ALTER TABLE users
    ALTER COLUMN password DROP NOT NULL;

CREATE TYPE oauth_provider AS ENUM ('SSAFY');

CREATE TABLE user_oauth_accounts
(
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          bigint         NOT NULL,
    provider         oauth_provider NOT NULL,
    -- 제공자가 주는 고유 식별자. 이메일은 바뀔 수 있으므로 연결의 기준은 이 값이다
    provider_user_id varchar(100)   NOT NULL,
    email            varchar(255),
    created_at       timestamp      NOT NULL DEFAULT now(),

    CONSTRAINT fk_user_oauth_accounts_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT uq_user_oauth_accounts_provider_user
        UNIQUE (provider, provider_user_id),
    CONSTRAINT uq_user_oauth_accounts_user_provider
        UNIQUE (user_id, provider)
);

CREATE INDEX idx_user_oauth_accounts_user_id ON user_oauth_accounts (user_id);
