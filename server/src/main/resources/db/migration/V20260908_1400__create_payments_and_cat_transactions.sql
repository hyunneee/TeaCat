-- ================================
-- 결제 (토스페이먼츠) · 캣머니 원장
-- ================================
-- 두 가지 결제가 이 스키마를 함께 쓴다.
--   ① 토큰 충전  : 카드 결제 → 캣머니 mint(DEPOSIT)
--   ② 티켓 결제  : 캣머니 burn(PAYMENT) + 남은 금액 카드 결제
-- 캣머니는 원화와 1:1 이고 decimals = 0 이라 두 금액의 단위가 같다.

-- ────────────────────────────────────────────────────────────
-- 캣머니 온체인 거래 원장
-- ────────────────────────────────────────────────────────────
-- 잔액은 저장하지 않는다 (blockchain/DESIGN.md 5-3 — 체인이 진실이고 캐시하면 어긋난다).
-- 이 테이블이 담는 것은 잔액이 아니라 **우리가 체인에 보낸 요청과 그 확정 여부**다.
--
-- 왜 필요한가 — 체인 잔액만 보고 결제를 판정할 수 없기 때문이다. 소각을 보내고
-- 확정되기까지 블록 한 개(10초)가 걸리는데 그 동안 체인 잔액은 예전 값이다.
-- 그 사이 포카 마켓 구매와 티켓 결제가 같은 잔액을 두 번 쓸 수 있다.
--   가용액 = 체인 잔액
--          − 미확정 소각 (cat_transactions 의 PENDING BURN)
--          − 결제 대기 중인 주문이 쓰기로 한 몫 (ticket_orders PENDING 의 token_amount)
-- 미확정 발행은 더하지 않는다. 아직 못 쓰는 게 맞다.

CREATE TYPE cat_tx_direction AS ENUM ('MINT', 'BURN');
CREATE TYPE cat_tx_reason AS ENUM ('DEPOSIT', 'REWARD', 'REFUND', 'PAYMENT', 'WITHDRAWAL');
CREATE TYPE cat_tx_status AS ENUM ('PENDING', 'CONFIRMED', 'ALREADY_DONE', 'FAILED');

CREATE TABLE cat_transactions
(
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       bigint           NOT NULL,
    -- 어느 지갑으로 보냈는지. 소각에 필요한 derivation_index 는 wallets → wallet_owners 로 따라간다
    wallet_id     bigint           NOT NULL,
    direction     cat_tx_direction NOT NULL,
    reason        cat_tx_reason    NOT NULL,
    -- 캣머니는 decimals = 0. uint256 을 담을 수 있는 자리수로 둔다 (wallet_seed_grants 와 동일)
    amount        numeric(78, 0)   NOT NULL,
    -- 체인 멱등 키. 컨트랙트가 재실행을 막아준다 (blockchain/DESIGN.md 4-3).
    -- 비밀값을 넣지 마세요 — keccak256 해시가 체인에 영구히 남는다.
    --   'charge:{token_charges.id}' / 'order:{ticket_orders.id}' 처럼 우리 PK 를 쓴다
    operation_key varchar(200)     NOT NULL,
    status        cat_tx_status    NOT NULL DEFAULT 'PENDING',
    -- 이미 처리돼 있던 경우(ALREADY_DONE)는 새 트랜잭션이 없어 NULL
    tx_hash       char(66),
    failure_code  varchar(50),
    settled_at    timestamp,
    created_at    timestamp        NOT NULL DEFAULT now(),
    updated_at    timestamp        NOT NULL DEFAULT now(),

    CONSTRAINT fk_cat_transactions_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_cat_transactions_wallet
        FOREIGN KEY (wallet_id) REFERENCES wallets (id),
    CONSTRAINT uq_cat_transactions_operation_key
        UNIQUE (operation_key),
    CONSTRAINT chk_cat_transactions_amount
        CHECK (amount > 0),
    -- 발행 사유와 소각 사유는 겹치지 않는다 (blockchain/DESIGN.md 6장 ②)
    CONSTRAINT chk_cat_transactions_direction_reason
        CHECK ((direction = 'MINT' AND reason IN ('DEPOSIT', 'REWARD', 'REFUND'))
            OR (direction = 'BURN' AND reason IN ('PAYMENT', 'WITHDRAWAL'))),
    CONSTRAINT chk_cat_transactions_settled
        CHECK ((status = 'PENDING' AND settled_at IS NULL)
            OR (status <> 'PENDING' AND settled_at IS NOT NULL))
);

CREATE INDEX idx_cat_transactions_user_created
    ON cat_transactions (user_id, created_at DESC, id DESC);
-- 가용액 계산 (유저별 미확정 소각 합계)
CREATE INDEX idx_cat_transactions_user_pending
    ON cat_transactions (user_id) WHERE status = 'PENDING';
-- 확정 폴링 대상 (오래된 것부터)
CREATE INDEX idx_cat_transactions_pending_created
    ON cat_transactions (created_at) WHERE status = 'PENDING';

-- ────────────────────────────────────────────────────────────
-- 토스 결제
-- ────────────────────────────────────────────────────────────

-- 토스 결제창·결제위젯이 요구하는 고객 식별자. 같은 회원은 늘 같은 값이어야
-- 토스 쪽에서 고객 단위로 묶인다.
--   🔴 이메일·전화번호 같은 개인정보를 넣으면 안 되고(토스 문서), 순번처럼 추측
--      가능해서도 안 된다. 그래서 회원 PK 가 아니라 별도 UUID 를 쓴다.
-- 첫 결제 때 만들어 넣으므로 nullable 이다
ALTER TABLE users
    ADD COLUMN payment_customer_key uuid;

CREATE UNIQUE INDEX uq_users_payment_customer_key
    ON users (payment_customer_key);


CREATE TYPE payment_purpose AS ENUM ('TOKEN_CHARGE', 'TICKET');
-- IN_PROGRESS 는 "토스에 승인을 요청했고 아직 결과를 모른다" 는 뜻이다. 승인 호출 직전에
-- 이 상태로 선점하고 커밋해야 같은 결제에 대한 중복 승인을 막을 수 있고, 서버가 그 사이에
-- 죽어도 복구 대상으로 남는다. READY 로 두면 죽은 뒤 승인이 나갔는지 알 길이 없다
CREATE TYPE payment_status AS ENUM ('READY', 'IN_PROGRESS', 'DONE', 'CANCELED', 'PARTIAL_CANCELED', 'ABORTED', 'EXPIRED');

CREATE TABLE payments
(
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- 토스에 넘기는 주문번호. 우리가 만든다 (토스 제약: 6~64자, 영문·숫자·하이픈·언더스코어).
    -- 순번처럼 추측 가능하면 남의 주문번호로 승인을 시도할 수 있으므로 UUID 를 쓴다
    order_id        varchar(64)     NOT NULL,
    user_id         bigint          NOT NULL,
    purpose         payment_purpose NOT NULL,
    -- 결제 금액(원). **결제 시작 시점에 서버가 확정해 저장한다.**
    -- 승인 요청에 프론트가 실어 보낸 amount 를 이 값과 대조하지 않으면 금액을 위조할 수 있다
    amount          int             NOT NULL,
    status          payment_status  NOT NULL DEFAULT 'READY',
    -- 승인 이후에만 채워진다. 토스가 발급하는 결제 식별자이고 취소·조회의 키다
    payment_key     varchar(200),
    -- 토스 응답의 method (카드 / 간편결제 / 계좌이체 …). 내역 표시·대사용
    method          varchar(30),
    receipt_url     text,
    canceled_amount int             NOT NULL DEFAULT 0,
    failure_code    varchar(50),
    failure_message varchar(255),
    approved_at     timestamp,
    created_at      timestamp       NOT NULL DEFAULT now(),
    updated_at      timestamp       NOT NULL DEFAULT now(),

    CONSTRAINT fk_payments_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT uq_payments_order_id
        UNIQUE (order_id),
    -- 승인 전에는 NULL 이고 Postgres 는 NULL 을 중복으로 보지 않는다
    CONSTRAINT uq_payments_payment_key
        UNIQUE (payment_key),
    -- 토스는 0원 결제를 받지 않는다. 전액 캣머니로 내는 티켓은 payments 행 자체를 만들지 않는다
    CONSTRAINT chk_payments_amount
        CHECK (amount > 0),
    CONSTRAINT chk_payments_canceled_amount
        CHECK (canceled_amount >= 0 AND canceled_amount <= amount),
    CONSTRAINT chk_payments_approved
        CHECK (status NOT IN ('DONE', 'CANCELED', 'PARTIAL_CANCELED')
            OR (payment_key IS NOT NULL AND approved_at IS NOT NULL))
);

CREATE INDEX idx_payments_user_created ON payments (user_id, created_at DESC, id DESC);
-- 승인 결과를 모른 채 남은 결제. 토스에 되물어 상태를 맞추는 복구 배치가 이 인덱스를 탄다
CREATE INDEX idx_payments_unsettled
    ON payments (created_at) WHERE status IN ('READY', 'IN_PROGRESS');

-- 취소 이력. payments.canceled_amount 만으로는 "언제 얼마를 왜" 가 남지 않고,
-- 토스 부분취소는 여러 번 일어날 수 있다
CREATE TABLE payment_cancels
(
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_id      bigint       NOT NULL,
    amount          int          NOT NULL,
    reason          varchar(200) NOT NULL,
    -- 토스 취소 API 의 Idempotency-Key 헤더로 그대로 보낸다. 재시도해도 중복 취소되지 않는다
    idempotency_key uuid         NOT NULL,
    -- 토스 응답의 취소 건 식별자
    transaction_key varchar(64),
    canceled_at     timestamp    NOT NULL DEFAULT now(),

    CONSTRAINT fk_payment_cancels_payment
        FOREIGN KEY (payment_id) REFERENCES payments (id),
    CONSTRAINT uq_payment_cancels_idempotency
        UNIQUE (idempotency_key),
    CONSTRAINT chk_payment_cancels_amount
        CHECK (amount > 0)
);

CREATE INDEX idx_payment_cancels_payment_id ON payment_cancels (payment_id);

-- ────────────────────────────────────────────────────────────
-- ① 토큰 충전
-- ────────────────────────────────────────────────────────────
-- 결제 승인으로 끝나지 않는다. 그 다음 체인 발행이 있고 확정은 비동기다.
-- payments 와 1:1 이지만 그 두 번째 단계 때문에 행을 따로 둔다.

CREATE TABLE token_charges
(
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_id bigint    NOT NULL,
    user_id    bigint    NOT NULL,
    -- 지급할 캣머니 수량. 지금은 원화와 1:1 이지만 보너스·프로모션이 붙으면 갈라지므로
    -- payments.amount 를 그대로 읽지 않고 발행 시점에 확정한 값을 남긴다
    amount     bigint    NOT NULL,
    -- 발행 트랜잭션. 승인 직후 만들어지고 확정은 폴링으로 채운다
    mint_tx_id bigint,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),

    CONSTRAINT fk_token_charges_payment
        FOREIGN KEY (payment_id) REFERENCES payments (id),
    CONSTRAINT fk_token_charges_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_token_charges_mint_tx
        FOREIGN KEY (mint_tx_id) REFERENCES cat_transactions (id),
    CONSTRAINT uq_token_charges_payment
        UNIQUE (payment_id),
    CONSTRAINT uq_token_charges_mint_tx
        UNIQUE (mint_tx_id),
    CONSTRAINT chk_token_charges_amount
        CHECK (amount > 0)
);

CREATE INDEX idx_token_charges_user_created
    ON token_charges (user_id, created_at DESC, id DESC);
-- 승인은 됐는데 발행을 못 보낸 건 (그 사이 서버가 죽은 경우) 복구 대상
CREATE INDEX idx_token_charges_unminted
    ON token_charges (created_at) WHERE mint_tx_id IS NULL;

-- ────────────────────────────────────────────────────────────
-- ② 티켓 결제
-- ────────────────────────────────────────────────────────────
-- 캣머니 사용분 + 카드 결제분으로 나뉘고, 성공하면 tickets 행이 생긴다.
-- 좌석은 결제를 시작할 때 이미 performance_seats 에 HELD 로 잡혀 있다.

CREATE TYPE ticket_order_status AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED');

CREATE TABLE ticket_orders
(
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id               bigint              NOT NULL,
    performance_detail_id bigint              NOT NULL,
    area_id               bigint              NOT NULL,
    seat_id               bigint, -- 스탠딩이면 NULL
    -- 티켓 가격(원). 주문 시점의 performance_areas.price 를 복사한다.
    -- 가격이 나중에 바뀌어도 이 주문이 얼마짜리였는지는 남아야 한다
    total_amount          int                 NOT NULL,
    -- 캣머니로 낸 금액. 원화와 1:1 이라 단위가 같다
    token_amount          int                 NOT NULL DEFAULT 0,
    -- 카드로 낸 금액. 캣머니가 전액을 덮으면 0 이고, 그때는 payment_id 가 NULL 이다
    cash_amount           int                 NOT NULL,
    status                ticket_order_status NOT NULL DEFAULT 'PENDING',
    payment_id            bigint,
    -- 결제 시 소각, 취소 시 환급. 둘 다 cat_transactions 를 가리킨다
    burn_tx_id            bigint,
    refund_tx_id          bigint,
    ticket_id             bigint,
    paid_at               timestamp,
    created_at            timestamp           NOT NULL DEFAULT now(),
    updated_at            timestamp           NOT NULL DEFAULT now(),

    CONSTRAINT fk_ticket_orders_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_ticket_orders_detail
        FOREIGN KEY (performance_detail_id) REFERENCES performance_details (id),
    CONSTRAINT fk_ticket_orders_area
        FOREIGN KEY (area_id) REFERENCES areas (id),
    CONSTRAINT fk_ticket_orders_seat
        FOREIGN KEY (seat_id) REFERENCES seats (id),
    CONSTRAINT fk_ticket_orders_payment
        FOREIGN KEY (payment_id) REFERENCES payments (id),
    CONSTRAINT fk_ticket_orders_burn_tx
        FOREIGN KEY (burn_tx_id) REFERENCES cat_transactions (id),
    CONSTRAINT fk_ticket_orders_refund_tx
        FOREIGN KEY (refund_tx_id) REFERENCES cat_transactions (id),
    CONSTRAINT fk_ticket_orders_ticket
        FOREIGN KEY (ticket_id) REFERENCES tickets (id),
    CONSTRAINT uq_ticket_orders_payment
        UNIQUE (payment_id),
    CONSTRAINT uq_ticket_orders_burn_tx
        UNIQUE (burn_tx_id),
    CONSTRAINT uq_ticket_orders_refund_tx
        UNIQUE (refund_tx_id),
    CONSTRAINT uq_ticket_orders_ticket
        UNIQUE (ticket_id),
    CONSTRAINT chk_ticket_orders_amounts
        CHECK (total_amount > 0
            AND token_amount >= 0
            AND cash_amount >= 0
            AND total_amount = token_amount + cash_amount),
    -- 토스는 0원 결제를 받지 않는다. 카드로 낼 금액이 있을 때만 payments 행이 생긴다
    CONSTRAINT chk_ticket_orders_payment_presence
        CHECK ((cash_amount = 0 AND payment_id IS NULL)
            OR (cash_amount > 0 AND payment_id IS NOT NULL)),
    -- 결제가 끝났으면 티켓이 있어야 한다 (취소된 주문에도 발급됐던 티켓이 남는다)
    CONSTRAINT chk_ticket_orders_paid
        CHECK (status NOT IN ('PAID', 'CANCELED')
            OR (ticket_id IS NOT NULL AND paid_at IS NOT NULL))
);

CREATE INDEX idx_ticket_orders_user_created
    ON ticket_orders (user_id, created_at DESC, id DESC);
CREATE INDEX idx_ticket_orders_detail_id ON ticket_orders (performance_detail_id);
-- 같은 좌석에 결제 대기 중인 주문은 하나뿐이다 (스탠딩은 seat_id 가 NULL 이라 대상에서 빠진다)
CREATE UNIQUE INDEX uq_ticket_orders_pending_seat
    ON ticket_orders (performance_detail_id, seat_id) WHERE status = 'PENDING';
-- 가용액 계산 (결제 대기 중인 주문이 쓰기로 한 캣머니) + 만료 주문 정리
CREATE INDEX idx_ticket_orders_pending
    ON ticket_orders (user_id, created_at) WHERE status = 'PENDING';
