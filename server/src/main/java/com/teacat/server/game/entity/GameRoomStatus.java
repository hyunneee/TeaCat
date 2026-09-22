package com.teacat.server.game.entity;

/** DB 의 game_room_status ENUM 과 1:1 */
public enum GameRoomStatus {
    /** 참가자를 받는 중. 초대 코드가 유효하다 */
    WAITING,
    /** 시작됐다. 더 들어올 수 없고 판돈이 묶여 있다 */
    PLAYING,
    /** 끝나고 정산까지 마쳤다 */
    FINISHED,
    /** 시작 전에 닫혔거나 판이 깨졌다. 판돈은 돌려준다 */
    ABORTED;

    /** 초대 코드로 찾아 들어올 수 있는 상태인가 */
    public boolean isOpen() {
        return this == WAITING;
    }

    public boolean isOver() {
        return this == FINISHED || this == ABORTED;
    }
}
