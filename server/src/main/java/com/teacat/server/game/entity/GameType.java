package com.teacat.server.game.entity;

/** DB 의 game_type ENUM 과 1:1 */
public enum GameType {

    /** 윷놀이. 턴제 — 던지고, 말을 고르고, 다음 사람에게 넘긴다 */
    YUT(1, 4),

    /**
     * 할리갈리. 카드를 뒤집는 것은 턴제지만 <b>종은 아무나 아무 때나</b> 친다.
     * 그래서 종 요청은 방 행을 잠가 줄을 세운다 — 먼저 도착한 요청이 이긴다.
     */
    HALLI_GALLI(1, 4);

    private final int minPlayers;
    private final int maxPlayers;

    GameType(int minPlayers, int maxPlayers) {
        this.minPlayers = minPlayers;
        this.maxPlayers = maxPlayers;
    }

    public int minPlayers() {
        return minPlayers;
    }

    public int maxPlayers() {
        return maxPlayers;
    }

    public boolean supports(int players) {
        return players >= minPlayers && players <= maxPlayers;
    }
}
