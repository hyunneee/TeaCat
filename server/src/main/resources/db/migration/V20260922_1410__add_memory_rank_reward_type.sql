-- 짝 맞추기 어제 1등에게 주는 보상.
--
-- 🔴 PostgreSQL 은 ADD VALUE 한 새 ENUM 값을 **같은 트랜잭션에서 쓸 수 없다.** 값 추가만
--    먼저 커밋하고 실제 사용(daily_rewards 행 삽입)은 애플리케이션이 한다.
--    (V20260916_1100 에서 같은 이유로 마이그레이션을 쪼갠 선례가 있다)
--
-- 기존 둘과 달리 **사용자가 누르는 보상이 아니다.** 스케줄러가 어제 1등을 찾아 넣는다.
-- 그래도 daily_rewards 를 같이 쓰는 이유는 하나다 — (user_id, reward_type, reward_date)
-- 유니크 인덱스가 "하루 한 번" 을 이미 보장하므로, 스케줄러가 두 번 돌아도 두 번 주지 않는다.

ALTER TYPE daily_reward_type ADD VALUE IF NOT EXISTS 'MEMORY_RANK';
