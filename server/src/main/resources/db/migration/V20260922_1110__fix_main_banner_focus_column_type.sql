-- ================================
-- 배포 장애 수습: 배너 크롭 컬럼 타입을 smallint → integer
-- ================================
-- 🔴 V20260922_1100 이 컬럼을 smallint 로 만들었는데 엔티티(MainBannerImageFocus)의 필드는
--    Integer 다. ddl-auto 가 validate 라 Hibernate 가 이 어긋남에서 멈추고,
--    **애플리케이션 컨텍스트가 통째로 못 뜬다**(스키마 검증은 부팅 중에 돈다).
--
--      Schema-validation: wrong column type encountered in column [image_focus_x]
--      in table [main_banners]; found [int2 (Types#SMALLINT)],
--      but expecting [integer (Types#INTEGER)]
--
--    Flyway 는 마이그레이션마다 커밋하므로 1100 은 이미 적용된 채로 앱만 죽는다.
--    그래서 되돌리지 않고 컬럼을 넓혀 맞춘다.
--
-- 🔴 **엔티티 타입과 컬럼 타입은 짝이다.** smallint 를 쓰려면 필드가 Short 여야 한다
--    (이 저장소의 유일한 선례가 wallet_owners.key_version ↔ Short 다).
--    0~100 을 담는 데 2바이트를 아끼는 것보다, 부팅이 되는 쪽이 훨씬 중요하다.
--
-- 버전을 1200 이 아니라 1110 으로 둔 이유: 아직 머지되지 않은 1200 이 나중에 들어와도
-- 순서가 어긋나지 않게 하기 위해서다 (1100 → 1110 → 1200).

ALTER TABLE main_banners
    ALTER COLUMN image_focus_x TYPE integer,
    ALTER COLUMN image_focus_y TYPE integer;

-- DEFAULT 50 과 CHECK (0~100) 은 타입 변경에도 그대로 남는다 — 다시 걸지 않는다.
