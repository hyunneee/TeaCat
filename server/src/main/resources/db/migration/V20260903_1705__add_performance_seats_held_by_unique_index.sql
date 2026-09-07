-- ================================
-- 좌석 선점(HOLD) 1인 1매 제약
-- ================================
--
-- "같은 회차에서 한 유저는 하나의 좌석만 선점한다" 는 규칙은 여러 행에 걸친 조건이라
-- 애플리케이션에서 SELECT 로 검사하면 검사와 UPDATE 사이가 뚫린다.
-- 부분 유니크 인덱스로 DB 가 강제하게 하고, 위반(23505) 을 잡아 에러 코드로 변환한다.
--
-- status = 'HELD' 인 행만 대상이므로 SOLD 가 된 뒤에는 다시 선점할 수 있다.
-- (1인 1티켓 규칙이 필요하면 tickets 쪽에서 따로 막는다)
CREATE UNIQUE INDEX uq_performance_seats_held_by
    ON performance_seats (performance_detail_id, held_by)
    WHERE status = 'HELD';
