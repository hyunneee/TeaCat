package com.teacat.server.wallet.entity;

/** DB 의 cat_money_hold_status ENUM 과 1:1 */
public enum CatMoneyHoldStatus {
    /** 가용 잔액에서 빠져 있음 */
    ACTIVE,
    /** 더 높은 입찰에 밀렸거나 경매가 다른 방식으로 끝나 풀림 */
    RELEASED,
    /** 낙찰·즉시구매로 실제 지급됨 */
    CAPTURED
}
