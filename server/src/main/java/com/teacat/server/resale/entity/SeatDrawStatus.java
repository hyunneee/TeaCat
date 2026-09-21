package com.teacat.server.resale.entity;

/** {@code seat_draw_status}. 값 설명은 마이그레이션 주석 참고 */
public enum SeatDrawStatus {
    PENDING,
    OPEN,
    REVEALED,
    SETTLED,
    /** 당첨자가 기한을 넘기거나 포기해 좌석을 되돌리고 새 회차로 다시 추첨했다 */
    REDRAWN,
    EXHAUSTED,
    FAILED;

    /** 아직 좌석을 쥐고 있는 추첨인가 (좌석이 일반 판매로 풀리지 않았고 다른 회차로 넘어가지도 않았다) */
    public boolean isActive() {
        return this == PENDING || this == OPEN || this == REVEALED;
    }
}
