-- ================================
-- HELD 행의 정합성을 DB 로 못 박는다
-- ================================
--
-- status = 'HELD' 인데 held_by 나 held_until 이 비어 있으면 좌석이 "주인 없이 잠긴" 상태가 된다.
-- 선점 조건이 held_until 을 보고, 1인 1매 인덱스가 held_by 를 보기 때문에 둘 중 하나만 비어도
-- 그 좌석은 아무도 잡을 수 없고 만료로 풀리지도 않는다.
--
-- 애플리케이션은 세 컬럼을 항상 같이 쓰지만, 손으로 넣는 UPDATE 나 다른 도메인의 접근을 대비해
-- DB 가 직접 막게 한다.
--
-- 조건을 'HELD' 인 행에만 거는 이유: 결제 확정으로 SOLD 가 될 때 구매자를 held_by 에 남기고
-- held_until 만 비우는 형태가 될 수 있어, 전체 행에 걸면 그 전환을 막아버린다.
ALTER TABLE performance_seats
    ADD CONSTRAINT chk_performance_seats_held
        CHECK (status <> 'HELD' OR (held_by IS NOT NULL AND held_until IS NOT NULL));
