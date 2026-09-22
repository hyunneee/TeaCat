-- ================================
-- 같이 하는 게임 (윷놀이 · 할리갈리)
-- ================================
-- 초대 코드로 모여서, 캣머니를 걸고, 등수별로 상금을 나눠 갖는다.
-- 상금 = 참가자들이 낸 판돈 + 운영 보조금(인원수 × 정액).
--
-- 🔴 돈이 도는 방식은 "홀드 → 순손익 정산" 이다. 게임을 시작할 때 판돈을 홀드로 묶고
--    (cat_money_holds, ref_type = GAME_BET), 끝나면 **차액만** 체인으로 옮긴다.
--    이긴 사람은 (받을 돈 − 낸 돈) 만큼 mint, 진 사람은 (낸 돈 − 받을 돈) 만큼 burn 이다.
--    판돈을 통째로 태웠다가 다시 발행하지 않는 이유는 체인 왕복이 두 배가 되고,
--    중간에 하나만 실패하면 원장이 한쪽으로 기울기 때문이다.
--    이 방식에서는 늘어나는 총량이 정확히 보조금과 같다.
--
-- 🔴 보조금은 공짜 돈이라 어뷰징 대상이다. 계정 두 개로 둘이서 계속 돌리면 판마다
--    보조금만큼이 그냥 생긴다. 그래서 (1) 혼자 하는 방은 판돈·상금·보조금이 전부 0인
--    연습 모드이고, (2) 보조금은 1인당 하루 한도를 둔다 (game.subsidy.daily-cap).
--    한도를 넘으면 판은 그대로 돌아가고 보조금만 깎인다.

CREATE TYPE game_type AS ENUM ('YUT', 'HALLI_GALLI');

-- WAITING  방이 열려 있고 참가자를 받는 중. 초대 코드가 유효하다
-- PLAYING  시작됐다. 더 들어올 수 없고 판돈이 묶여 있다
-- FINISHED 끝나고 정산까지 마쳤다
-- ABORTED  시작 전에 닫혔거나, 시작 후 남은 사람이 한 명도 없어 판이 깨졌다. 판돈은 돌려준다
CREATE TYPE game_room_status AS ENUM ('WAITING', 'PLAYING', 'FINISHED', 'ABORTED');

-- JOINED   방에 있다 (아직 시작 전)
-- PLAYING  게임 중
-- RETIRED  중간에 나갔다. 남은 사람이 손해 보지 않도록 판돈은 그대로 두고 꼴찌로 처리한다
-- FINISHED 끝까지 했다
CREATE TYPE game_participant_status AS ENUM ('JOINED', 'PLAYING', 'RETIRED', 'FINISHED');

CREATE TABLE game_rooms
(
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- 초대 코드. 헷갈리는 글자(0/O, 1/I)를 뺀 대문자+숫자 6자
    invite_code     varchar(8)       NOT NULL,
    game_type       game_type        NOT NULL,
    host_user_id    bigint           NOT NULL,
    -- 1인당 판돈. 0이면 연습 모드다
    bet_amount      bigint           NOT NULL DEFAULT 0,
    max_players     int              NOT NULL,
    status          game_room_status NOT NULL DEFAULT 'WAITING',
    -- 게임판 전체. 진행 중 상태의 진실은 여기 하나뿐이고, 항상 이 행을 잠근 채 읽고 쓴다.
    -- 할리갈리의 종 치기가 동시에 들어와도 그 락이 줄을 세워 **먼저 도착한 요청이 이긴다**.
    state           jsonb,
    -- 정산 때 확정되는 값들. 진행 중에는 0이다
    prize_pool      bigint           NOT NULL DEFAULT 0,
    subsidy         bigint           NOT NULL DEFAULT 0,
    -- 이번 턴이 끝나야 하는 시각. 넘기면 스위퍼가 대신 진행시킨다 (아무도 안 하면 판이 멈춘다)
    turn_expires_at timestamp,
    started_at      timestamp,
    finished_at     timestamp,
    created_at      timestamp        NOT NULL DEFAULT now(),
    updated_at      timestamp        NOT NULL DEFAULT now(),

    CONSTRAINT fk_game_rooms_host FOREIGN KEY (host_user_id) REFERENCES users (id),
    CONSTRAINT chk_game_rooms_bet CHECK (bet_amount >= 0),
    CONSTRAINT chk_game_rooms_max_players CHECK (max_players BETWEEN 1 AND 4),
    CONSTRAINT chk_game_rooms_state CHECK (state IS NULL OR jsonb_typeof(state) = 'object')
);

-- 코드는 살아 있는 방들 사이에서만 겹치지 않으면 된다. 끝난 방의 코드는 다시 쓸 수 있다
CREATE UNIQUE INDEX uq_game_rooms_open_code
    ON game_rooms (invite_code)
    WHERE status IN ('WAITING', 'PLAYING');

CREATE INDEX idx_game_rooms_status_created ON game_rooms (status, created_at DESC);

-- 턴이 멈춘 방을 훑는다
CREATE INDEX idx_game_rooms_turn_expires
    ON game_rooms (turn_expires_at)
    WHERE status = 'PLAYING';

CREATE TABLE game_participants
(
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id       bigint                  NOT NULL,
    user_id       bigint                  NOT NULL,
    -- 자리 번호 0..3. 턴 순서이자, 게임판 state 안에서 이 사람을 가리키는 인덱스다
    seat_no       int                     NOT NULL,
    status        game_participant_status NOT NULL DEFAULT 'JOINED',
    ready         boolean                 NOT NULL DEFAULT false,
    -- 실제로 묶인 판돈. 방의 bet_amount 를 시작 시점에 베껴 둔다 (방 설정이 바뀌어도 판은 그대로)
    bet           bigint                  NOT NULL DEFAULT 0,
    -- 정산 결과. rank 1이 1등이다. payout 이 NULL 이 아니면 정산이 끝난 것이다
    rank          int,
    payout        bigint,
    -- 이 판에서 이 사람 몫으로 새로 찍어낸 보조금. 하루 한도를 이 값의 합으로 센다.
    -- 받은 금액이 아니라 **만들어진 금액**이다 — 총량이 얼마나 늘었나가 한도의 기준이다
    subsidy_share bigint                  NOT NULL DEFAULT 0,
    settled_at    timestamp,
    -- 순손익을 체인에 반영(mint/burn)하고 홀드까지 푼 시각. NULL 이면 스위퍼가 다시 민다
    chain_settled_at timestamp,
    created_at    timestamp               NOT NULL DEFAULT now(),
    updated_at    timestamp               NOT NULL DEFAULT now(),

    CONSTRAINT fk_game_participants_room FOREIGN KEY (room_id) REFERENCES game_rooms (id),
    CONSTRAINT fk_game_participants_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT uq_game_participants_room_user UNIQUE (room_id, user_id),
    CONSTRAINT uq_game_participants_room_seat UNIQUE (room_id, seat_no),
    CONSTRAINT chk_game_participants_seat CHECK (seat_no BETWEEN 0 AND 3),
    CONSTRAINT chk_game_participants_bet CHECK (bet >= 0),
    CONSTRAINT chk_game_participants_payout CHECK (payout IS NULL OR payout >= 0),
    CONSTRAINT chk_game_participants_subsidy CHECK (subsidy_share >= 0)
);

CREATE INDEX idx_game_participants_room ON game_participants (room_id);

-- 하루 보조금 한도를 셀 때 쓴다
CREATE INDEX idx_game_participants_user_settled
    ON game_participants (user_id, settled_at)
    WHERE subsidy_share > 0;

-- ── 원장 CHECK 확장 ───────────────────────────────────────
-- 값 자체는 V20260922_1600 이 이미 추가했다. 여기서 비로소 쓸 수 있다.
ALTER TABLE cat_transactions
    DROP CONSTRAINT chk_cat_transactions_direction_reason;

ALTER TABLE cat_transactions
    ADD CONSTRAINT chk_cat_transactions_direction_reason
        CHECK ((direction = 'MINT' AND reason IN ('DEPOSIT', 'REWARD', 'REFUND', 'ADMIN_GRANT', 'GAME_PRIZE'))
            OR (direction = 'BURN' AND reason IN ('PAYMENT', 'WITHDRAWAL', 'ADMIN_BURN', 'GAME_BET')));

-- 체인 반영이 안 끝난 정산을 스위퍼가 훑는다
CREATE INDEX idx_game_participants_chain_pending
    ON game_participants (settled_at)
    WHERE settled_at IS NOT NULL AND chain_settled_at IS NULL;
