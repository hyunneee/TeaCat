package com.teacat.server.performance.entity;

/**
 * DB 의 ticketing_status ENUM 과 1:1 로 대응한다. 회차(performance_details)의 예매 상태다.
 */
public enum TicketingStatus {
    SCHEDULED,
    OPEN,
    SOLD_OUT,
    CLOSED
}
