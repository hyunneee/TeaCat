-- 실패한 유료 생성의 **환불 여부**를 남긴다.
--
-- 🔴 `paid_cat` 만으로는 부족하다. 그 값은 "얼마를 받았나" 이지 "돌려줬나" 가 아니다.
--    표시가 없으면 스위퍼가 돌 때마다 같은 건을 또 돌려준다.
--
-- 🔴 실패 경로가 **셋**이라 표시를 건별로 둬야 한다:
--      · 재시도 소진 (failExhausted)
--      · 워커가 아예 없음 (failAbandoned)
--      · 워커가 실패를 신고 (StickerJobWorkerService.fail)
--    어느 길로 실패했든 "FAILED 인데 paid_cat > 0 이고 refunded_at 이 비었다" 하나로 걸린다.
--    경로마다 환불 코드를 심으면 한 곳을 빠뜨리고, 그건 돈이 안 돌아가는 사고다.
--
-- ⚠️ 이 칼럼을 지우려면 먼저 환불 재시도 방법을 다른 데 마련할 것.
ALTER TABLE sticker_jobs
    ADD COLUMN refunded_at TIMESTAMPTZ;

COMMENT ON COLUMN sticker_jobs.refunded_at IS
    '실패해서 캣머니를 돌려준 시각. paid_cat > 0 이고 이 값이 비어 있으면 아직 안 돌려줬다';

-- 스위퍼가 매분 훑는 조회다. 대상이 거의 없으므로 부분 인덱스로 좁게 잡는다
CREATE INDEX idx_sticker_jobs_refund_pending
    ON sticker_jobs (id)
    WHERE status = 'FAILED' AND paid_cat > 0 AND refunded_at IS NULL;
