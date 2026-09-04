package com.teacat.server.performance.entity;

/**
 * 회차의 예매 오픈 상태 (API-206).
 *
 * DB 에 저장하는 값이 아니다. ticketing_status 와 티켓팅 시각·공연 일자를 조합해 매번 계산한다.
 * 클라이언트 시계를 믿을 수 없어 서버가 판단해 내려준다.
 */
public enum BookingOpenStatus {
    /** 티켓팅 시작 전 */
    BEFORE,
    /** 예매 가능 */
    OPEN,
    /** 매진 */
    SOLDOUT,
    /** 예매 종료 (공연이 지났거나 판매를 닫음) */
    CLOSED
}
