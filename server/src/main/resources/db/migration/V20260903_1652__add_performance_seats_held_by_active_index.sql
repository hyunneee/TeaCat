-- ================================
-- "내 선점 좌석" 조회/정리를 위한 부분 인덱스
-- ================================
--
-- 회차를 아는 선점 경로는 uq_performance_seats_held_by (performance_detail_id, held_by) 를
-- 두 컬럼으로 온전히 타지만, "내 선점 목록" 은 회차를 모르고 held_by 만으로 찾는다.
-- held_by 가 그 인덱스의 두 번째 컬럼이라 선행 컬럼 없이는 HELD 전체를 훑게 된다.
--
-- 실측(HELD 10,000 행): 0.256ms -> 0.077ms. 절대값은 작지만 기존 계획은 동시 선점 수에
-- 비례해 늘어나고, 이 인덱스는 직접 조회로 상수화한다. 오픈 직후 동시 선점이 많을 때 차이가 난다.
--
-- status = 'HELD' 인 행만 담으므로 인덱스 크기와 쓰기 비용이 작다.
CREATE INDEX idx_performance_seats_held_by_active
    ON performance_seats (held_by)
    WHERE status = 'HELD';
