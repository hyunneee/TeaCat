package com.teacat.server.resale.entity;

/** {@code resale_entry_status}. 값 설명은 마이그레이션 주석 참고 */
public enum ResaleEntryStatus {
    WAITING,
    WON,
    PURCHASED,
    LOST,
    EXPIRED,
    FORFEITED,
    CANCELED;

    /** 사용자 화면(내 대기 내역)에 보이는 상태인가. 스스로 접은 것은 보이지 않는다 */
    public boolean isVisibleToUser() {
        return this != CANCELED && this != FORFEITED;
    }
}
