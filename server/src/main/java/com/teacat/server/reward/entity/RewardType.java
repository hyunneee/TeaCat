package com.teacat.server.reward.entity;

/**
 * 하루 한 번 받을 수 있는 캣머니 보상의 종류. DB 의 {@code daily_reward_type} ENUM 과 1:1.
 *
 * <p>🔴 <b>금액은 여기에만 적는다.</b> 화면이 보낸 금액을 믿으면 콘솔에서 0 을 더 붙일 수 있다
 * (client/CLAUDE.md 7장 — 금액의 출처는 항상 서버). 요청 본문에 금액 자리를 두지 않은 것도
 * 같은 이유다.
 */
public enum RewardType {

    /** 출석 체크 — 누르기만 하면 받는다 */
    ATTENDANCE(500L),

    /**
     * 송편 잡기 5단계 완주.
     *
     * <p>⚠️ <b>판정은 브라우저가 한다.</b> 서버는 단계를 세지 않으므로 "정말 깼는지" 는 검증되지
     * 않는다 — 콘솔을 열 줄 아는 사람은 클리어 없이 부를 수 있다. 이벤트 보상이고 하루 상한이
     * 걸려 있어 지금은 감수한다. 막으려면 단계 시작·성공을 서버가 받아 세야 한다.
     */
    SONGPYEON(1000L);

    private final long amount;

    RewardType(long amount) {
        this.amount = amount;
    }

    public long amount() {
        return amount;
    }
}
