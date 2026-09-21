-- 로그인 단말 기록 (AUCTION_FRAUD_DESIGN.md 5-1, R8 계정 탈취 의심 전용).
-- "처음 보는 단말에서 로그인한 직후 고액 구매" 를 판정하려면 계정별 로그인 단말 이력이 필요하다.
-- 로그인·소셜 로그인 성공 시 한 행. 리프레시는 기록하지 않는다(같은 단말이다).
-- 심사 외 용도가 없으므로 nft.trade.review.login-event-retention(기본 90일) 지난 행은 스위퍼가 지운다.

CREATE TABLE user_login_events
(
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         bigint      NOT NULL,
    client_ip       varchar(45) NOT NULL,
    user_agent_hash char(64)    NOT NULL,
    created_at      timestamp   NOT NULL DEFAULT now(),

    CONSTRAINT fk_user_login_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_user_login_events_user
    ON user_login_events (user_id, created_at DESC);

-- 보관 기간 정리용
CREATE INDEX idx_user_login_events_created_at
    ON user_login_events (created_at);
