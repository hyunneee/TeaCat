-- ================================
-- 공연 등록자(created_by) 추가
-- ================================
--
-- 관리자 API(API-262~271)는 "본인이 등록한 공연" 만 수정·삭제할 수 있어야 한다.
-- 그러려면 누가 등록했는지 행에 남아 있어야 한다.
--
-- 기존 행은 등록자를 알 수 없어 NULL 로 둔다. NULL 인 공연은 아무도 소유하지 않은 것으로 보고
-- 관리자 API 가 거절한다(PERFORMANCE_020). 필요하면 운영에서 직접 지정한다.
-- 등록자 회원이 지워질 일은 없지만(회원 탈퇴는 소프트 삭제), 혹시 지워지면 소유자 없는 공연으로 남긴다.

ALTER TABLE performance_general
    ADD COLUMN created_by bigint;

ALTER TABLE performance_general
    ADD CONSTRAINT fk_performance_general_created_by
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL;

-- 관리자가 "내가 등록한 공연" 을 조회할 때 쓴다
CREATE INDEX idx_performance_general_created_by ON performance_general (created_by);
