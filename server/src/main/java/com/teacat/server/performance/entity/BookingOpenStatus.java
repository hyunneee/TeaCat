package com.teacat.server.performance.entity;

import java.time.LocalDateTime;

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
    CLOSED;

    /**
     * DB 판매 상태와 예매·공연 시각을 조합해 현재 예매 상태를 계산한다.
     *
     * <p>{@link TicketingStatus#SCHEDULED}는 예매 오픈 전용 영속 상태가 아니라
     * 정해진 시각에 자동으로 열릴 회차를 뜻한다. 따라서 SCHEDULED와 OPEN 모두
     * 오픈 시각이 지나면 실질 상태가 OPEN이다. SOLD_OUT과 CLOSED는 운영자가
     * 지정하는 예외 상태라 시간보다 우선한다.
     */
    public static BookingOpenStatus resolve(TicketingStatus ticketingStatus,
                                            LocalDateTime ticketingStartAt,
                                            LocalDateTime performanceDate,
                                            LocalDateTime now) {
        if (ticketingStatus == TicketingStatus.CLOSED || !performanceDate.isAfter(now)) {
            return CLOSED;
        }
        if (ticketingStatus == TicketingStatus.SOLD_OUT) {
            return SOLDOUT;
        }
        if (ticketingStartAt.isAfter(now)) {
            return BEFORE;
        }
        return OPEN;
    }
}
