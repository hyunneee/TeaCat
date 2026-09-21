-- ================================
-- 취소표 대기 · 좌석 추첨 · 알림
-- ================================
-- 취소표가 나오면 좌석을 바로 풀지 않고, 그 구역 대기자를 대상으로 온체인 추첨
-- (VerifiableDraw — 커밋·리빌 + 블록해시)을 돌려 당첨자에게 결제 기한이 있는 선점을
-- 준다. (blockchain/DESIGN.md 6장 ③, PHOTOCARD_PLAN.md 4장)
--
-- 🔴 seat_booking_status 에 값을 더하지 않는다. 추첨이 도는 동안 좌석은 SOLD 로 남고
--    (아무도 못 잡는다), 당첨자에게는 HELD(held_by = 당첨자, held_until = 결제 기한) 로
--    넘긴다. 그래서 당첨자는 평소 결제 흐름을 그대로 탄다 — 좌석 상태 switch 를 고칠
--    필요가 없다.

-- ── 대기 신청 ──────────────────────────────────────────────
-- WAITING   추첨 대기 중. 구역 단위로 건다
-- WON       당첨. deadline_at 까지 seat_id 를 결제해야 한다
-- PURCHASED 당첨 좌석을 결제해 티켓을 받았다
-- LOST      회차의 취소 마감이 지나 더 이상 취소표가 나올 수 없다
-- EXPIRED   당첨됐지만 기한 안에 결제하지 않았다. 보통은 WAITING 으로 되돌리고(다음 표부터 다시 참여),
--           같은 구역에 이미 새 대기가 있을 때만 이 값으로 끝난다
-- FORFEITED 당첨을 스스로 포기하고 대기도 끝냈다 ("다시 대기" 를 고르면 WAITING 으로 돌아간다)
-- CANCELED  대기 중에 신청을 취소했다
CREATE TYPE resale_entry_status AS ENUM
    ('WAITING', 'WON', 'PURCHASED', 'LOST', 'EXPIRED', 'FORFEITED', 'CANCELED');

CREATE TABLE resale_entries
(
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id               bigint              NOT NULL,
    performance_detail_id bigint              NOT NULL,
    area_id               bigint              NOT NULL,
    quantity              int                 NOT NULL DEFAULT 1,
    status                resale_entry_status NOT NULL DEFAULT 'WAITING',
    -- 당첨 좌석. WON 이후에만 값이 있다
    seat_id               bigint,
    -- 당첨된 추첨. 어느 난수로 뽑혔는지 여기서 따라간다
    seat_draw_id          bigint,
    -- 당첨 결제 기한. WON 일 때만 값이 있다
    deadline_at           timestamp,
    created_at            timestamp           NOT NULL DEFAULT now(),
    updated_at            timestamp           NOT NULL DEFAULT now(),

    CONSTRAINT fk_resale_entries_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_resale_entries_detail
        FOREIGN KEY (performance_detail_id) REFERENCES performance_details (id),
    CONSTRAINT fk_resale_entries_area
        FOREIGN KEY (area_id) REFERENCES areas (id),
    CONSTRAINT fk_resale_entries_seat
        FOREIGN KEY (seat_id) REFERENCES seats (id),
    CONSTRAINT chk_resale_entries_quantity
        CHECK (quantity >= 1)
);

-- 한 사람은 한 회차·한 구역에 대기 하나만 건다. 취소하고 다시 걸면 새 행이다
CREATE UNIQUE INDEX uq_resale_entries_waiting
    ON resale_entries (user_id, performance_detail_id, area_id)
    WHERE status = 'WAITING';

-- 취소표가 나올 때 "이 구역 대기자" 를 한 번에 읽는다
CREATE INDEX idx_resale_entries_area_waiting
    ON resale_entries (performance_detail_id, area_id)
    WHERE status = 'WAITING';

-- 기한 지난 당첨을 훑는다
CREATE INDEX idx_resale_entries_won_deadline
    ON resale_entries (deadline_at)
    WHERE status = 'WON';

CREATE INDEX idx_resale_entries_user_id ON resale_entries (user_id);

-- ── 좌석 추첨 ──────────────────────────────────────────────
-- 취소된 좌석 하나에 추첨 하나. 참가자(대기자) 목록은 커밋 시점에 굳고 inputsHash 로
-- 체인에 묶인다 — 결과를 보고 참가자를 바꿀 수 없다.
--
-- PENDING    커밋을 아직 보내지 못했다 (블록체인 서비스가 죽어 있었거나 방금 만들어짐)
-- OPEN       커밋을 보냈다. 블록체인 서비스가 다음 블록에 자동으로 리빌한다
-- REVEALED   난수가 확정되고 순위(ranking)가 저장됐다. 1순위(그 사이 대기를 접은 사람은 건너뜀)가 구매권을 쥔다
-- SETTLED    당첨자가 결제해 좌석이 팔렸다
-- REDRAWN    당첨자가 기한을 넘기거나 포기했다. 좌석을 되돌리고 새 draw_no 로 **다시 추첨**했다
-- EXHAUSTED  후보가 없어(대기자 0명) 좌석을 일반 판매로 풀었다
-- FAILED     블록해시 창(256블록)을 넘기는 등 되살릴 수 없다. 새 draw_no 로 다시 연다
--
-- 🔴 기한 만료·포기는 순위 이양이 아니라 **재추첨**이다. 그 사이 대기가 늘었을 수 있고,
--    "표가 나오면 그때의 대기자 전원을 대상으로 뽑는다" 는 규칙이 두 번째 표에도 같아야 한다.
CREATE TYPE seat_draw_status AS ENUM
    ('PENDING', 'OPEN', 'REVEALED', 'SETTLED', 'REDRAWN', 'EXHAUSTED', 'FAILED');

CREATE TABLE seat_draws
(
    id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    performance_id         bigint           NOT NULL,
    performance_detail_id  bigint           NOT NULL,
    area_id                bigint           NOT NULL,
    seat_id                bigint           NOT NULL,
    -- 같은 좌석에 몇 번째 추첨인지. 재추첨이 눈에 띄어야 한다 (drawKey 에 들어간다)
    draw_no                int              NOT NULL DEFAULT 1,
    -- 체인에 보내는 키. keccak256 이 drawId 가 된다. 한 번 쓰면 다시 못 쓴다
    draw_key               varchar(200)     NOT NULL,
    status                 seat_draw_status NOT NULL DEFAULT 'PENDING',
    -- 커밋에 묶인 참가자(resale_entries.id) — 오름차순, 콤마 구분
    participant_ids        text             NOT NULL,
    inputs_hash            varchar(66),
    open_tx_hash           varchar(66),
    -- 확정된 난수. 누구나 이 값과 participant_ids 로 순위를 다시 계산할 수 있다
    randomness             varchar(66),
    -- 난수로 계산된 당첨 순위 — 콤마 구분 entry id
    ranking                text,
    -- 다음에 구매권을 줄 순위 인덱스 (0부터)
    next_rank              int              NOT NULL DEFAULT 0,
    -- 지금 구매권을 쥔 대기 신청
    current_entry_id       bigint,
    -- 취소돼 이 추첨을 만든 주문
    source_ticket_order_id bigint,
    failure_reason         varchar(200),
    created_at             timestamp        NOT NULL DEFAULT now(),
    updated_at             timestamp        NOT NULL DEFAULT now(),

    CONSTRAINT uq_seat_draws_draw_key UNIQUE (draw_key),
    CONSTRAINT fk_seat_draws_detail
        FOREIGN KEY (performance_detail_id) REFERENCES performance_details (id),
    CONSTRAINT fk_seat_draws_area
        FOREIGN KEY (area_id) REFERENCES areas (id),
    CONSTRAINT fk_seat_draws_seat
        FOREIGN KEY (seat_id) REFERENCES seats (id),
    CONSTRAINT fk_seat_draws_current_entry
        FOREIGN KEY (current_entry_id) REFERENCES resale_entries (id)
);

-- 한 좌석에 진행 중인 추첨은 하나뿐이다
CREATE UNIQUE INDEX uq_seat_draws_active_seat
    ON seat_draws (performance_detail_id, seat_id)
    WHERE status IN ('PENDING', 'OPEN', 'REVEALED');

CREATE INDEX idx_seat_draws_status ON seat_draws (status);

ALTER TABLE resale_entries
    ADD CONSTRAINT fk_resale_entries_seat_draw
        FOREIGN KEY (seat_draw_id) REFERENCES seat_draws (id);

-- ── 알림 ──────────────────────────────────────────────────
-- 사용자에게 보여줄 인앱 알림. 취소표 당첨처럼 사용자가 다른 화면에 있을 때 생기는
-- 일을 남긴다. type 은 enum 이 아니라 문자열이다 — 종류가 늘 때마다 ALTER TYPE 을
-- 두 마이그레이션으로 쪼갤 이유가 없다 (Java 쪽 enum 이 값을 관리한다).
CREATE TABLE notifications
(
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    bigint       NOT NULL,
    type       varchar(40)  NOT NULL,
    title      varchar(100) NOT NULL,
    body       varchar(500) NOT NULL,
    -- 누르면 갈 프론트 경로. 예: /my/resale
    link_url   varchar(300),
    -- 무엇에 대한 알림인지. 예: RESALE_ENTRY / 123
    ref_type   varchar(40),
    ref_id     bigint,
    read_at    timestamp,
    created_at timestamp    NOT NULL DEFAULT now(),

    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_notifications_user_created
    ON notifications (user_id, created_at DESC);

CREATE INDEX idx_notifications_user_unread
    ON notifications (user_id)
    WHERE read_at IS NULL;
