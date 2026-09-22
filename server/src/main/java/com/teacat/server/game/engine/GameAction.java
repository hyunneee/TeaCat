package com.teacat.server.game.engine;

/**
 * 플레이어가 보낸 행동 하나.
 *
 * <p>게임마다 쓰는 필드가 다르다 — 윷놀이는 {@code THROW} / {@code MOVE}(piece, value),
 * 할리갈리는 {@code FLIP} / {@code BELL}(둘 다 인자 없음). 게임 수가 둘뿐이라 타입을
 * 나누기보다 한 모양으로 받고 엔진이 검사한다.
 *
 * @param kind  행동 이름. 엔진이 모르는 값이면 거절한다
 * @param piece 윷놀이에서 움직일 말 번호 (0..3)
 * @param value 윷놀이에서 쓸 던지기 결과 (1..5)
 */
public record GameAction(String kind, Integer piece, Integer value) {

    public boolean is(String other) {
        return other.equalsIgnoreCase(kind);
    }
}
