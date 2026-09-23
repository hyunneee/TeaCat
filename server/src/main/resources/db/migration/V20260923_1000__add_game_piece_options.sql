-- ================================
-- 윷놀이 — 말 개수와 말 모양
-- ================================
-- 판을 만들 때 말을 몇 개로 할지 고르고, 사람마다 말 모양을 따로 고른다.
--
-- 🔴 둘 다 **방에 저장한다.** 화면에만 두면 남이 내 말을 어떤 모양으로 보는지 알 수 없고,
--    새로고침하면 사라진다. 말 모양은 누구 말인지 가리는 표시라 모두가 같은 값을 봐야 한다.

ALTER TABLE game_rooms
    -- 한 사람이 쓸 말의 수. 윷놀이만 쓴다 (할리갈리는 카드 수가 정해져 있다)
    ADD COLUMN pieces_per_player int NOT NULL DEFAULT 4;

ALTER TABLE game_rooms
    ADD CONSTRAINT chk_game_rooms_pieces CHECK (pieces_per_player BETWEEN 1 AND 4);

ALTER TABLE game_participants
    -- 말 모양 이름. 화면이 그림으로 바꾼다 (값은 client 의 PIECE_STYLES 와 짝)
    -- NULL 이면 아직 안 골랐다는 뜻이고, 화면이 자리 번호로 기본 모양을 준다
    ADD COLUMN piece_style varchar(20);

-- 한 방에서 같은 모양을 둘이 쓰면 누구 말인지 구별할 수 없다.
-- 부분 인덱스라 안 고른 사람(NULL)끼리는 부딪히지 않는다
CREATE UNIQUE INDEX uq_game_participants_piece_style
    ON game_participants (room_id, piece_style)
    WHERE piece_style IS NOT NULL;
