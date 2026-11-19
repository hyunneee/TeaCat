package com.teacat.server.game.entity;

/**
 * 말 모양. 대기실에서 각자 고른다.
 *
 * <p>한 방에서 <b>겹치지 않는다</b> — 판 위에 같은 그림이 둘이면 색만으로 내 말을 찾아야
 * 하는데, 자리 색은 네 개가 다 비슷한 채도라 빠르게 구분되지 않는다. 겹치지 않게 막는
 * 곳은 DB 의 부분 유니크 인덱스(`uq_game_participants_piece_style`)다 — 두 사람이 같은
 * 순간에 같은 모양을 고르면 마지막에 닿은 쪽이 거절된다.
 *
 * <p>값은 그림 이름일 뿐이라 화면이 어떤 아이콘으로 그릴지는 클라이언트가 정한다.
 * DB 컬럼은 varchar 다(Postgres enum 이 아니다) — 모양을 늘리는 데 마이그레이션이
 * 필요하지 않게 하려는 것이다.
 */
public enum GamePieceStyle {

    CAT,
    DOG,
    RABBIT,
    BIRD,
    FISH,
    TURTLE,
    MONKEY,
    SHEEP
}
