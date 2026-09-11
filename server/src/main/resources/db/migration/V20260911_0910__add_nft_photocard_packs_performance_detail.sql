-- ================================
-- 카드팩: 어느 회차의 것인가
-- ================================
-- 카드팩을 언제부터 열 수 있는지는 저장하지 않는다. 회차의 공연 일시에서 매번 계산한다.
--
--   개봉 가능 = performance_details.performance_date − booking.policy.cancel-deadline-lead ≤ now()
--
-- 예매 취소 마감이 같은 식을 쓰므로(TicketCancelRecorder) 두 값이 어긋날 수가 없다.
-- 값을 지급 시점에 얼려 두면 공연을 연기했을 때 개봉 시각만 옛 자리에 남아,
-- 그 차이만큼 "카드를 뽑고 예매를 취소해 전액 환불받는" 창이 열린다.
-- 발행된 카드는 컨트랙트에 소각 함수가 없어 회수할 수 없다. 개봉·취소 창이 겹치지 않는 것이
-- 1차 방어선이고, 그래도 회차 연기로 취소 마감이 되돌아가는 경우를 대비해 이미 연 팩에 대한
-- 취소 자체를 거절하는 것(TicketCancelRecorder.invalidate, PAYMENT_017)이 2차 방어선이다.
--
-- NULL 이면 회차에 매이지 않은 팩(이벤트 팩)이고 즉시 열 수 있다.
ALTER TABLE nft_photocard_packs
    ADD COLUMN performance_detail_id bigint REFERENCES performance_details (id);

-- 개봉 판정이 이 컬럼으로 회차를 찾는다
CREATE INDEX idx_nft_photocard_packs_performance_detail
    ON nft_photocard_packs (performance_detail_id)
    WHERE performance_detail_id IS NOT NULL;
