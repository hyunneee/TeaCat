-- performance_areas.sale_type 에 기본값을 준다.
--
-- V20260909_1200 에서 NOT NULL 로 추가했는데, 이 컬럼을 모르는 INSERT 가 전부 깨졌다
-- (팀원들의 통합 테스트 픽스처 4곳). 애플리케이션은 항상 값을 명시하므로
-- 기본값을 둬도 "판매 방식이 없는 행" 은 생기지 않는다.
--
-- 기본값을 SEATED 로 두는 이유: 이 컬럼이 없던 시절의 행은 모두 좌석제였고,
-- 방식을 신경 쓰지 않고 쓰는 INSERT 도 좌석을 지목해 예매하는 흐름을 전제한다.
-- (areas.level_code 가 '1F' 기본값을 갖는 것과 같은 이유의 편의 기본값이다)
ALTER TABLE performance_areas ALTER COLUMN sale_type SET DEFAULT 'SEATED';
