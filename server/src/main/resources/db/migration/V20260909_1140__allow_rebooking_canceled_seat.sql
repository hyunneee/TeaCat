-- ================================
-- 취소된 좌석 재판매
-- ================================
-- uq_tickets_detail_seat 은 (회차, 좌석) 조합을 통째로 유일하게 잡고 있었다.
-- 예매 취소가 없던 시절에는 맞았지만, 취소가 생기면서 깨진다 —
-- 취소는 좌석을 AVAILABLE 로 풀어 주는데, 그 좌석을 다시 사면 같은 조합으로
-- 티켓 행을 만들 수 없어 **결제는 끝났는데 발권이 실패한다.**
--
-- 실제로 취소된 좌석을 재구매하다 이 제약에 걸렸다.
--
-- 지켜야 할 규칙은 "한 회차의 한 좌석에 **유효한** 티켓은 하나" 다.
-- 취소된 행은 이력으로 남아야 하므로 부분 유니크 인덱스로 바꾼다.
--   (스탠딩은 seat_id 가 NULL 이라 예전과 같이 대상에서 빠진다)

ALTER TABLE tickets DROP CONSTRAINT uq_tickets_detail_seat;

CREATE UNIQUE INDEX uq_tickets_detail_seat_confirmed
    ON tickets (performance_detail_id, seat_id)
    WHERE status = 'CONFIRMED';
