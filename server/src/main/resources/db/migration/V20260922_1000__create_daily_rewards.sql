-- ================================
-- 캣머니 하루 한 번 보상 (출석 체크 · 송편 잡기)
-- ================================
-- "오늘 이미 받았는가" 를 담는 표다. 지급 자체는 체인 발행(cat_transactions)이고,
-- 이 표는 **하루 한 번**이라는 규칙만 지킨다.
--
-- 🔴 하루 한 번을 막는 것은 애플리케이션 코드가 아니라 아래 UNIQUE 인덱스다.
--    버튼을 두 번 빠르게 누르면 두 요청이 나란히 "아직 안 받았다" 를 읽는다 —
--    코드로만 막으면 그 창에서 두 번 발행된다.

CREATE TYPE daily_reward_type AS ENUM ('ATTENDANCE', 'SONGPYEON');

CREATE TABLE daily_rewards
(
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id            bigint            NOT NULL,
    reward_type        daily_reward_type NOT NULL,
    -- 받은 날짜(Asia/Seoul). 앱 컨테이너가 TZ=Asia/Seoul 이라 LocalDate.now() 가 이 값이다
    reward_date        date              NOT NULL,
    -- 지급한 금액. 금액을 나중에 바꿔도 예전에 얼마를 줬는지 남아야 한다
    amount             bigint            NOT NULL,
    -- 어떤 발행으로 나갔는지. 발행을 보내기 전에 행이 먼저 생기므로 잠깐 NULL 이다
    cat_transaction_id bigint,
    created_at         timestamp         NOT NULL DEFAULT now(),

    CONSTRAINT fk_daily_rewards_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_daily_rewards_cat_tx
        FOREIGN KEY (cat_transaction_id) REFERENCES cat_transactions (id),
    CONSTRAINT chk_daily_rewards_amount
        CHECK (amount > 0)
);

-- 한 사람이 한 종류를 하루에 한 번. 이 인덱스가 규칙 그 자체다
CREATE UNIQUE INDEX uq_daily_rewards_user_type_date
    ON daily_rewards (user_id, reward_type, reward_date);
