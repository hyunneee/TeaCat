package com.teacat.server.game.entity;

/** DB 의 game_participant_status ENUM 과 1:1 */
public enum GameParticipantStatus {
    /** 방에 있다 (아직 시작 전) */
    JOINED,
    /** 게임 중 */
    PLAYING,
    /**
     * 중간에 나갔다.
     *
     * <p>판돈은 돌려주지 않고 꼴찌로 처리한다. 돌려주면 "지고 있으면 나가면 된다" 가 되어
     * 남은 사람이 딸 돈이 사라진다.
     */
    RETIRED,
    /** 끝까지 했다 */
    FINISHED;

    /** 아직 판에 남아 있나 */
    public boolean isAlive() {
        return this == JOINED || this == PLAYING;
    }
}
