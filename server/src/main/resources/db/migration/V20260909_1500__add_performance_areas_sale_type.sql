-- ================================
-- 공연별 구역 판매 방식 (좌석제 / 스탠딩)
-- ================================
--
-- 좌석제인지 스탠딩인지는 지금까지 공연장 구역(areas.type)에만 있었다. 그런데 같은 구역을
-- 공연마다 다르게 파는 일이 있다 — 의자가 없는 플로어를 이번엔 스탠딩으로, 다음엔 좌석을
-- 그려 좌석제로 파는 식이다. 공연장 쪽 값을 바꾸면 그 공연장의 모든 공연이 함께 바뀌므로
-- 공연 × 구역 단위인 이 테이블에 판매 방식을 따로 든다.
--
-- 기본값을 SEATED 로 둔다. 이 컬럼이 없던 시절의 행은 모두 좌석제였고, 컬럼을 모르는
-- INSERT(통합 테스트 픽스처 등)도 좌석을 지목해 예매하는 흐름을 전제한다.
-- 애플리케이션은 항상 값을 명시하므로 판매 방식이 없는 행은 생기지 않는다.
-- (areas.level_code 가 '1F' 기본값을 갖는 것과 같은 이유의 편의 기본값이다)
--
-- 🔴 어느 방식으로 팔 수 있는지는 **공연장이 무엇을 등록해 뒀는지**로 정해진다.
--
--      의자 있음(areas.type=SEATED) + 좌석 등록  →  좌석 지정만
--      의자 없음(STANDING)          + 좌석 등록  →  둘 다
--      의자 없음                    + 좌석 없음  →  스탠딩만
--      의자 있음                    + 좌석 없음  →  팔 수 없는 구역
--
--    의자가 깔린 구역을 스탠딩으로 파는 것은 막는다 — 의자가 자리에 그대로 있어 사람을
--    세울 수 없다. 의자를 치운 구성은 무대 형식(stadium_layouts)을 따로 만들어 표현한다.
--    두 테이블(areas·seats)에 걸친 조건이라 DB CHECK 로는 표현할 수 없어 서비스가 검사한다
--    (PerformanceErrorCode.AREA_SALE_TYPE_NOT_ALLOWED).

ALTER TABLE performance_areas
    ADD COLUMN sale_type area_type DEFAULT 'SEATED';

-- 기존 행은 공연장 구역의 형태를 그대로 물려받는다 (지금까지의 동작과 같다)
UPDATE performance_areas pa
   SET sale_type = a.type
  FROM areas a
 WHERE a.id = pa.area_id;

ALTER TABLE performance_areas
    ALTER COLUMN sale_type SET NOT NULL;
