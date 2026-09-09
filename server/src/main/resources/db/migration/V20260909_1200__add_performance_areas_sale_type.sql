-- ================================
-- 공연별 구역 판매 방식 (좌석제 / 스탠딩)
-- ================================
--
-- 좌석제인지 스탠딩인지는 지금까지 공연장 구역(areas.type)에만 있었다. 그런데 같은 구역을
-- 공연마다 다르게 파는 일이 흔하다 — 아레나 플로어를 이번엔 스탠딩으로, 다음엔 의자를 깔아
-- 좌석제로 파는 식이다. 공연장 쪽 값을 바꾸면 그 공연장의 모든 공연이 함께 바뀌므로
-- 공연 × 구역 단위인 이 테이블에 판매 방식을 따로 든다.
--
-- 기존 행은 공연장 구역의 형태를 그대로 물려받는다 (지금까지의 동작과 같다).
--
-- 🔴 "스탠딩 구역을 좌석제로 판다" 는 성립하지 않는다 — 스탠딩 구역에는 좌석 좌표가 없어
--    배정할 자리가 없다. 반대 방향(좌석제 구역을 스탠딩으로 판매)만 허용하며,
--    두 테이블에 걸친 조건이라 DB CHECK 로는 표현할 수 없어 서비스가 검사한다
--    (PerformanceErrorCode.AREA_SALE_TYPE_NOT_ALLOWED).

ALTER TABLE performance_areas
    ADD COLUMN sale_type area_type;

UPDATE performance_areas pa
   SET sale_type = a.type
  FROM areas a
 WHERE a.id = pa.area_id;

ALTER TABLE performance_areas
    ALTER COLUMN sale_type SET NOT NULL;
