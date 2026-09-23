package com.teacat.server.game.engine;

/**
 * 방을 만들 때 고른 값들. 시작할 때 엔진에 넘어간다.
 *
 * <p>엔진마다 쓰는 값이 다르다 — 말 수는 윷놀이만 쓰고 할리갈리는 무시한다. 그래도 인자를
 * 게임별로 나누지 않은 이유는 {@link GameEngine} 이 게임 종류를 모르는 채로 불리기 때문이다.
 * 값이 늘면 이 record 에 필드를 더한다.
 */
public record GameOptions(int piecesPerPlayer) {
}
