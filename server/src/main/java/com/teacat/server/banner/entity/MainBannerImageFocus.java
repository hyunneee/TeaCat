package com.teacat.server.banner.entity;

/**
 * 배너 이미지에서 <b>보여줄 부분</b>.
 *
 * 배너 틀은 폰 4:3, 데스크톱 2:1 이다. 올린 그림의 비율이 이와 다르면 남는 쪽이 잘리는데,
 * 무엇을 남길지는 그림마다 다르다 — 얼굴이 위에 있는 포스터는 가운데를 남기면 목만 보인다.
 * 그래서 관리자가 고르고, 화면은 이 값을 CSS {@code object-position} 으로 옮긴다.
 *
 * 공연 배너(포스터)에도 걸린다. 3:4 포스터를 2:1 로 자를 때가 가장 많이 잘린다.
 */
public enum MainBannerImageFocus {
    TOP_LEFT, TOP, TOP_RIGHT,
    LEFT, CENTER, RIGHT,
    BOTTOM_LEFT, BOTTOM, BOTTOM_RIGHT
}
