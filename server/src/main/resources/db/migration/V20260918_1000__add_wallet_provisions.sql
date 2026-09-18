-- ================================
-- 가입 시 지갑 발급을 비동기로 (RabbitMQ)
-- ================================
-- 가입 트랜잭션은 이 표에 PENDING 행만 넣고 끝난다. 실제 지갑 파생과 시드 발행은
-- 큐 소비자가 이 행을 보고 한다. 큐 메시지는 "이 행을 지금 처리해라"는 신호일 뿐이고,
-- 메시지가 사라져도 스위퍼가 PENDING 행을 훑어 다시 보낸다. 진실은 언제나 이 행이다.
--
--   user_id UNIQUE       — 회원 하나에 발급 요청 하나. 메시지가 중복 소비돼도 지갑이 둘 생기지 않는다
--   derivation_index     — 첫 시도에서 시퀀스로 확보해 **여기 먼저 저장**한 뒤 체인을 부른다.
--                          재시도는 같은 인덱스를 다시 쓰므로 체인이 ALREADY_DONE 으로 답하고
--                          시드가 두 번 나가지 않는다. 시도마다 새로 뽑으면 첫 시도의 주소로
--                          1,500 CAT 이 주인 없이 나간다.
--   attempts/last_error  — 왜 안 되는지 어드민이 볼 수 있게 남긴다

CREATE TYPE wallet_provision_status AS ENUM ('PENDING', 'DONE');

CREATE TABLE wallet_provisions
(
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          bigint                  NOT NULL,
    status           wallet_provision_status NOT NULL DEFAULT 'PENDING',
    derivation_index int,
    attempts         int                     NOT NULL DEFAULT 0,
    last_error       text,
    created_at       timestamp               NOT NULL DEFAULT now(),
    updated_at       timestamp               NOT NULL DEFAULT now(),
    -- DONE 이 된 시각. created_at 과의 차이가 "가입 후 지갑이 준비되기까지 걸린 시간" 이다
    provisioned_at   timestamp,

    CONSTRAINT fk_wallet_provisions_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT uq_wallet_provisions_user
        UNIQUE (user_id),
    CONSTRAINT uq_wallet_provisions_derivation_index
        UNIQUE (derivation_index)
);

-- 스위퍼가 "오래 PENDING 인 행" 을 찾는 인덱스. DONE 은 대부분이라 제외한다
CREATE INDEX idx_wallet_provisions_pending
    ON wallet_provisions (updated_at)
    WHERE status = 'PENDING';

-- 이미 지갑이 있는 회원은 DONE 으로 채워 "회원마다 발급 행이 하나" 를 처음부터 만족시킨다
INSERT INTO wallet_provisions (user_id, status, derivation_index, created_at, updated_at, provisioned_at)
SELECT DISTINCT ON (user_id) user_id, 'DONE', derivation_index, created_at, created_at, created_at
FROM wallet_owners
ORDER BY user_id, id;
