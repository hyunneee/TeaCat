-- ================================
-- 포토카드 짝 맞추기 — 판 기록
-- ================================
-- 하루치 랭킹(빠른 순)과 그 1등에게 주는 다음날 보상의 근거다.
--
-- 🔴 **걸린 시간을 클라이언트에게 받지 않는다.** 시작할 때 행을 만들고, 클리어를 받을 때
--    서버 시계로 빼서 넣는다. 화면이 보낸 숫자를 그대로 믿으면 콘솔에서 0.1초를 적어 넣고
--    매일 1등을 가져간다 — 금액의 출처가 서버여야 하는 것과 같은 이유다
--    (client/CLAUDE.md 7장, RewardType 주석).
--
-- ⚠️ 이것으로 막히는 것은 "시간 조작" 까지다. 자동으로 판을 푸는 스크립트는 여전히 가능하다.
--    막으려면 카드 배치와 뒤집기를 서버가 쥐어야 하는데, 이벤트 보상 규모에 비해 과하다고 봤다.

CREATE TABLE memory_game_sessions
(
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    bigint    NOT NULL,
    -- 랭킹을 가르는 날짜. started_at 의 날짜를 박아 둔다 — 자정을 걸쳐 끝난 판은 시작한 날의 것이다
    played_on  date      NOT NULL,
    started_at timestamp NOT NULL DEFAULT now(),
    -- 아래 셋은 클리어했을 때만 채워진다. 포기하거나 그냥 나간 판은 NULL 로 남아 랭킹에 안 든다
    cleared_at timestamp,
    elapsed_ms int,
    moves      int,

    CONSTRAINT fk_memory_game_sessions_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    -- 0ms 클리어는 시계가 어긋났거나 조작이다. 랭킹 맨 위를 차지하므로 아예 못 들어오게 한다
    CONSTRAINT chk_memory_game_sessions_elapsed
        CHECK (elapsed_ms IS NULL OR elapsed_ms > 0),
    -- 셋은 한 몸이다. 하나만 채워진 행이 생기면 랭킹이 조용히 이상해진다
    CONSTRAINT chk_memory_game_sessions_cleared
        CHECK ((cleared_at IS NULL) = (elapsed_ms IS NULL)
           AND (cleared_at IS NULL) = (moves IS NULL))
);

-- 하루 랭킹을 뽑는 경로. 클리어한 판만 본다
CREATE INDEX idx_memory_game_sessions_rank
    ON memory_game_sessions (played_on, elapsed_ms)
    WHERE elapsed_ms IS NOT NULL;

-- 내 오늘 기록·내 등수
CREATE INDEX idx_memory_game_sessions_user_day
    ON memory_game_sessions (user_id, played_on);
