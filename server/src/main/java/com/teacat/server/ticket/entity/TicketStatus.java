package com.teacat.server.ticket.entity;

/** DB 의 ticket_status ENUM 과 1:1. 예매 자체의 상태다 */
public enum TicketStatus {

    CONFIRMED,
    /** 예매 취소. 발행됐던 SBT 는 소각 대상이 된다 */
    CANCELLED
}
