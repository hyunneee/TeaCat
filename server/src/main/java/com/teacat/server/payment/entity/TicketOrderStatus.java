package com.teacat.server.payment.entity;

/** DB 의 ticket_order_status ENUM 과 1:1 */
public enum TicketOrderStatus {

    /** 금액이 확정됐고 아직 결제가 끝나지 않았다 */
    PENDING,
    /** 결제 완료 + 티켓 발권 완료 */
    PAID,
    /** 승인이 거절됐거나 주문이 무산됐다 */
    FAILED,
    /** 예매 취소 */
    CANCELED;

    /** 이 주문이 캣머니를 쓰기로 예약한 상태인가 (가용액에서 빼야 하는가) */
    public boolean reservesToken() {
        return this == PENDING;
    }
}
