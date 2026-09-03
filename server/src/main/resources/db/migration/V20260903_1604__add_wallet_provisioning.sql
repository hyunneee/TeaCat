-- ================================
-- 가입 시 지갑 발급 (blockchain 서비스 연동)
-- ================================

-- 파생 인덱스 발급기.
--   시퀀스는 트랜잭션이 롤백돼도 되돌아가지 않는다. 그래서 가입이 실패해도
--   그 인덱스는 소모된 채로 남고 **재사용되지 않는다.**
--   재사용되면 다른 사람에게 이전 유저의 주소가 배정되고 남은 자산까지 딸려 간다.
--   (blockchain/DESIGN.md 5-1)
CREATE SEQUENCE wallet_derivation_index_seq
    AS integer
    START WITH 0
    MINVALUE 0
    INCREMENT BY 1
    NO CYCLE;

-- 가입 축하금 발행 내역.
--   체인 트랜잭션은 보낸 즉시 확정되지 않는다(SSAFY 체인 블록 10초).
--   보냈다는 사실과 txHash 를 남겨 두어야 나중에 확정 여부를 확인할 수 있다.
CREATE TYPE wallet_seed_status AS ENUM ('PENDING', 'CONFIRMED', 'ALREADY_DONE');

CREATE TABLE wallet_seed_grants
(
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wallet_id  bigint             NOT NULL,
    -- 캣머니는 decimals = 0 이라 소수가 없다. uint256 을 담을 수 있는 자리수로 둔다
    amount     numeric(78, 0)     NOT NULL,
    status     wallet_seed_status NOT NULL,
    -- 이미 발행돼 있던 경우(ALREADY_DONE)는 새 트랜잭션이 없어 NULL
    tx_hash    char(66),
    created_at timestamp          NOT NULL DEFAULT now(),
    updated_at timestamp          NOT NULL DEFAULT now(),

    CONSTRAINT fk_wallet_seed_grants_wallet
        FOREIGN KEY (wallet_id) REFERENCES wallets (id),
    -- 시드는 지갑당 한 번뿐이다
    CONSTRAINT uq_wallet_seed_grants_wallet
        UNIQUE (wallet_id),
    CONSTRAINT chk_wallet_seed_grants_amount
        CHECK (amount > 0)
);

CREATE INDEX idx_wallet_seed_grants_status ON wallet_seed_grants (status);
