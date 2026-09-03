-- ================================
-- 공연 CRUD(API-261~263)에 필요한 컬럼 추가
-- ================================
--
-- API-263 은 "예매 이력이 없으면 삭제, 있으면 비공개" 다.
-- 비공개는 행을 남긴 채 목록/상세에서만 감추는 것이라 소프트 삭제 컬럼이 필요하다.
-- (users 도 같은 방식으로 deleted_at 을 쓴다)

ALTER TABLE performance_general
    ADD COLUMN updated_at timestamp NOT NULL DEFAULT now();

ALTER TABLE performance_general
    ADD COLUMN deleted_at timestamp;

-- 목록 조회(API-201)는 노출 시작일이 지난 공연만 보여준다
CREATE INDEX idx_performance_general_visible_from ON performance_general (visible_from);
