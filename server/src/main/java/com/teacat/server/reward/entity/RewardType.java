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
    SONGPYEON(1000L),
    /**
     * 포토카드 짝 맞추기 <b>어제 1등</b>.
     *
     * <p>🔴 <b>사용자가 누를 수 없다.</b> 다른 둘과 달리 스케줄러가 어제 기록을 보고 넣는다
     * ({@code MemoryRankRewardScheduler}). 그래서 {@link #claimable()} 이 false 이고,
     * 오늘의 보상 목록(`GET /users/me/rewards/daily`)에도 나오지 않는다 — 목록에 띄우면
     * "누르면 받는 것" 으로 읽혀서 못 누르는 줄만 늘어난다.
     *
     * <p>같은 {@code daily_rewards} 표를 쓰는 이유는 유니크 인덱스다. (user, type, date) 가
     * "하루 한 번" 을 이미 보장하므로 스케줄러가 두 번 돌아도 두 번 주지 않는다.
     */
    MEMORY_RANK(1000L, false);

    private final long amount;
    private final boolean claimable;

    RewardType(long amount) {
        this(amount, true);
    }

    RewardType(long amount, boolean claimable) {
        this.amount = amount;
        this.claimable = claimable;
    }

    public long amount() {
        return amount;
    }

    /** 사용자가 직접 눌러서 받을 수 있는가. false 면 서버가 정한 조건으로만 들어온다 */
    public boolean claimable() {
        return claimable;
    }
}
