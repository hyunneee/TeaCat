-- ================================
-- 방향·사유 CHECK 에 관리자 조정 사유를 넣는다
-- ================================
-- 앞 마이그레이션(V20260914_1000)이 enum 값을 추가했고, 여기서 비로소 그 값을 쓴다.
-- 파일이 나뉜 이유는 그쪽 주석에 있다 (트랜잭션 안에서 새 enum 값을 못 쓴다).
--
-- 발행 사유와 소각 사유는 여전히 겹치지 않는다 (blockchain/DESIGN.md 6장 ②).
--   ADMIN_GRANT → MINT,  ADMIN_BURN → BURN

ALTER TABLE cat_transactions
    DROP CONSTRAINT chk_cat_transactions_direction_reason;

ALTER TABLE cat_transactions
    ADD CONSTRAINT chk_cat_transactions_direction_reason
        CHECK ((direction = 'MINT' AND reason IN ('DEPOSIT', 'REWARD', 'REFUND', 'ADMIN_GRANT'))
            OR (direction = 'BURN' AND reason IN ('PAYMENT', 'WITHDRAWAL', 'ADMIN_BURN')));
