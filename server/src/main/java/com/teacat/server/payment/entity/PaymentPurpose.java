package com.teacat.server.payment.entity;

/** DB 의 payment_purpose ENUM 과 1:1 */
public enum PaymentPurpose {

    /** 캣머니 충전 */
    TOKEN_CHARGE,
    /** 티켓 결제 (캣머니로 덮고 남은 금액) */
    TICKET
}
