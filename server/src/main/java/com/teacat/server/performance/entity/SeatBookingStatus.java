package com.teacat.server.performance.entity;

/**
 * DB 의 seat_booking_status ENUM 과 1:1 로 대응한다.
 *
 * HELD 는 결제 대기 중 선점 상태다. held_until 이 지나면 해제 대상이 된다.
 */
public enum SeatBookingStatus {
    AVAILABLE,
    HELD,
    SOLD
}
