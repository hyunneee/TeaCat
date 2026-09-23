package com.teacat.server.game.engine.halligalli;

/**
 * 할리갈리 카드 한 장.
 *
 * @param fruit 과일 이름 (CHERRY · BANANA · LIME · GRAPE)
 * @param count 그려진 개수 1..5
 */
public record HalliGalliCard(String fruit, int count) {
}
