-- ================================
-- 캣머니 홀드 원장
-- ================================
--
-- 체인에는 lock 이 없고, 입찰마다 체인 트랜잭션을 만들 수도 없다(블록 10초).
-- 그래서 "쓸 수 있는 돈" 은 Spring 이 판정한다: 가용 잔액 = 체인 잔액 − 유효(ACTIVE) 홀드 합.
-- 잔액 자체는 여전히 저장하지 않는다 (blockchain/DESIGN.md 5-3).
--
-- 다른 지출 경로(티켓 결제 등)도 반드시 가용 잔액을 봐야 이 원장이 의미를 가진다.

CREATE TYPE cat_money_hold_status AS ENUM ('ACTIVE', 'RELEASED', 'CAPTURED');

-- AUCTION_BID: ref_id = 입찰 id / AUCTION_BUY_NOW: ref_id = 경매 id
CREATE TYPE cat_money_hold_ref_type AS ENUM ('AUCTION_BID', 'AUCTION_BUY_NOW');

CREATE TABLE cat_money_holds
(
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         bigint                  NOT NULL,
    amount          bigint                  NOT NULL,
    ref_type        cat_money_hold_ref_type NOT NULL,
    ref_id          bigint                  NOT NULL,
    status          cat_money_hold_status   NOT NULL DEFAULT 'ACTIVE',
    -- CAPTURED 로 바뀔 때 보낸 체인 트랜잭션. transfer 연동 전에는 NULL
    capture_tx_hash char(66),
    created_at      timestamp               NOT NULL DEFAULT now(),
    updated_at      timestamp               NOT NULL DEFAULT now(),

    CONSTRAINT fk_cat_money_holds_user FOREIGN KEY (user_id) REFERENCES users (id),
    -- 출처 하나에 홀드 하나
    CONSTRAINT uq_cat_money_holds_ref UNIQUE (ref_type, ref_id),
    CONSTRAINT chk_cat_money_holds_amount CHECK (amount > 0)
);

-- 가용 잔액 계산은 유저의 ACTIVE 홀드만 읽는다
CREATE INDEX idx_cat_money_holds_user_active ON cat_money_holds (user_id) WHERE status = 'ACTIVE';
